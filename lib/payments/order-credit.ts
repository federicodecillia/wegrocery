import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { reportError } from "@/lib/observability";
import { sameOrderLines } from "@/lib/order-draft";
import { balanceDueParts, walletCreditAvailableCentsSql, type BalancePart } from "./balance-due";
import { audit, genId, notifyMember, type Db } from "./effects";
import type { OrderSnapshot } from "./order-payment";
import { walletTransferSql } from "./wallet-transfer";
import { sendRequestedRefund, type RefundApi } from "./refund-request";
import { getStripe } from "./stripe";

// A paid Checkout Session of an order payment (payments.kind = 'order').
export type OrderCreditAction = {
  kind: "order_credit";
  paymentId: string;
  cycleId: string;
  sessionId: string;
  amountCents: number;
  currency: string;
  paymentIntentId: string | null;
};

// The snapshot's lines as rows. Column names are the JSON keys.
const snapshotLines = sql`jsonb_to_recordset(p.order_snapshot->'lines')
  AS l("productId" text, quantity integer, "unitPriceCents" integer)`;

// A payment row closed by the app (its Checkout was expired, or never came
// back from Stripe) that Stripe may still report as paid.
const CLOSED_UNPAID = new Set(["failed", "expired"]);

async function isCredited(db: Db, paymentId: string): Promise<boolean> {
  const { rows } = await db.execute(
    sql`SELECT 1 FROM ledger_entries WHERE payment_id = ${paymentId} AND type = 'order_payment'`,
  );
  return rows.length > 0;
}

function isGuardError(e: unknown): boolean {
  return e instanceof Error && /22012|division by zero/i.test(e.message);
}

// The payment's ledger rows, from the guarded update of its row: the order
// part (amount minus the wallet debt it paid) as order_payment on the cycle,
// the debt as one balance_payment per part (balanceDueParts, worked out when
// the money lands). Its CTE `upd` is the updated payment.
function creditSql(a: OrderCreditAction, fromStatuses: string[], parts: BalancePart[], tail?: ReturnType<typeof sql>) {
  return sql`
    WITH upd AS (
      UPDATE payments
      SET status = 'succeeded',
          checkout_session_id = ${a.sessionId},
          payment_intent_id = coalesce(${a.paymentIntentId}, payment_intent_id),
          updated_at = now()
      WHERE payment_id = ${a.paymentId} AND status IN (${sql.join(fromStatuses.map((st) => sql`${st}`), sql`, `)})
      RETURNING payment_id, member_id, amount_cents, balance_cents
    ),
    ord AS (
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
      SELECT ${genId("led")}, member_id, now(), 'order_payment', (amount_cents - balance_cents)::numeric / 100,
             ${a.cycleId}, ${t.ledger.orderPayment}, 'stripe', now(), payment_id
      FROM upd
      RETURNING payment_id
    ),
    bal AS (
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, payment_id)
      SELECT 'led_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), upd.member_id, now(),
             'balance_payment', p.cents::numeric / 100, p."cycleId", ${t.ledger.balancePayment}, 'stripe', now(),
             upd.payment_id
      FROM upd, jsonb_to_recordset(${JSON.stringify(parts)}::jsonb) AS p("cycleId" text, cents integer)
      WHERE upd.balance_cents > 0
      RETURNING payment_id
    )
    ${tail ?? sql`SELECT count(*) FROM ord`}`;
}

async function cycleTitle(db: Db, cycleId: string): Promise<string> {
  const { rows } = await db.execute<{ title: string }>(sql`SELECT title FROM order_cycles WHERE cycle_id = ${cycleId}`);
  return rows[0]?.title ?? "";
}

// The wallet debt a payment paid, split as the debts are now.
async function debtParts(db: Db, payment: PaymentRow): Promise<BalancePart[]> {
  return payment.balance_cents > 0 ? balanceDueParts(db, payment.member_id, payment.balance_cents) : [];
}

// The payment becomes the member's order: ONE transaction (db.batch) that
// locks the cycle like saveOrder and the close do, checks that the payment is
// the pending one the app created and that the cycle can still take the
// order, replaces the member's lines with the paid snapshot, and credits the
// payment: its order part on the cycle, the wallet debt it paid as
// balance_payment rows (`parts`), and moves the wallet credit the snapshot
// counted on, as far as the wallet still holds it (what is missing stays to
// pay on the cycle, for the settlement). A guard that fails rolls everything
// back (22012).
async function creditBatch(db: Db, a: OrderCreditAction, payment: PaymentRow, parts: BalancePart[]): Promise<boolean> {
  const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${a.cycleId} FOR UPDATE`);
  const guard = db.execute(sql`
    SELECT 1 / (CASE WHEN
      (SELECT status FROM order_cycles WHERE cycle_id = ${a.cycleId}) = 'open'
      AND EXISTS (
        SELECT 1 FROM payments
        WHERE payment_id = ${a.paymentId} AND status = 'pending' AND kind = 'order' AND cycle_id = ${a.cycleId}
          AND amount_cents = ${a.amountCents} AND currency = ${a.currency}
          AND (checkout_session_id IS NULL OR checkout_session_id = ${a.sessionId})
      )
      AND NOT EXISTS (
        SELECT 1 FROM payments p, ${snapshotLines}
        WHERE p.payment_id = ${a.paymentId}
          AND NOT EXISTS (
            SELECT 1 FROM products pr
            WHERE pr.product_id = l."productId" AND pr.cycle_id = ${a.cycleId} AND pr.active
          )
      )
    THEN 1 ELSE 0 END) AS credit_guard
  `);
  const deleteOrder = db.execute(sql`
    DELETE FROM orders
    WHERE cycle_id = ${a.cycleId}
      AND member_id = (SELECT member_id FROM payments WHERE payment_id = ${a.paymentId})
  `);
  const insertOrder = db.execute(sql`
    INSERT INTO orders
      (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
    SELECT gen_random_uuid()::text, ${a.cycleId}, p.member_id, l."productId", l.quantity,
           l."unitPriceCents"::numeric / 100, (l."unitPriceCents" * l.quantity)::numeric / 100, now()
    FROM payments p, ${snapshotLines}
    WHERE p.payment_id = ${a.paymentId} AND l.quantity > 0
  `);
  const credit = db.execute(creditSql(a, ["pending"], parts));
  const walletCredit = Math.max(0, payment.order_snapshot?.walletCreditCents ?? 0);
  const transfer = db.execute(
    walletTransferSql({
      memberId: payment.member_id,
      cycleId: a.cycleId,
      cents: sql`least(${walletCredit}, ${walletCreditAvailableCentsSql(payment.member_id)})`,
      direction: "to_cycle",
      notes: { wallet: t.ledger.walletCreditOut(await cycleTitle(db, a.cycleId)), cycle: t.ledger.walletCreditIn },
      createdBy: "stripe",
    }),
  );
  try {
    await db.batch([lock, guard, deleteOrder, insertOrder, credit, transfer]);
    return true;
  } catch (e) {
    if (isGuardError(e)) return false;
    throw e;
  }
}

type PaymentRow = {
  member_id: string;
  status: string;
  kind: string;
  cycle_id: string | null;
  amount_cents: number;
  balance_cents: number;
  currency: string;
  checkout_session_id: string | null;
  order_snapshot: OrderSnapshot | null;
};

async function readPayment(db: Db, paymentId: string): Promise<PaymentRow | null> {
  const { rows } = await db.execute<PaymentRow>(sql`
    SELECT member_id, status, kind, cycle_id, amount_cents, balance_cents, currency, checkout_session_id, order_snapshot
    FROM payments WHERE payment_id = ${paymentId}
  `);
  return rows[0] ?? null;
}

// The money arrived but the order cannot exist (the cycle closed, or a paid
// product left it): ONE statement credits the payment and asks for the full
// refund of its order part, so the cycle's net for the member goes back to
// zero. The wallet debt it paid stays paid; no wallet credit moves.
async function creditLate(db: Db, a: OrderCreditAction, parts: BalancePart[]): Promise<string | null> {
  const { rows } = await db.execute<{ refund_id: string }>(
    creditSql(
      a,
      ["pending", "failed", "expired"],
      parts,
      sql`
    INSERT INTO refunds
      (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason, stripe_refund_id,
       created_by, created_at, updated_at)
    SELECT 'late_' || payment_id, payment_id, member_id, ${a.cycleId}, amount_cents - balance_cents, 'requested',
           'late_payment', NULL, 'system', now(), now()
    FROM upd
    ON CONFLICT DO NOTHING
    RETURNING refund_id`,
    ),
  );
  return rows[0]?.refund_id ?? null;
}

async function afterCredit(db: Db, a: OrderCreditAction, payment: PaymentRow): Promise<void> {
  // The draft the member paid from is done; a different one (edited during
  // the checkout) stays as unconfirmed changes.
  const paid = payment.order_snapshot?.lines ?? [];
  const { rows: drafts } = await db.execute<{ lines: { productId: string; quantity: number }[] }>(
    sql`SELECT lines FROM order_drafts WHERE member_id = ${payment.member_id} AND cycle_id = ${a.cycleId}`,
  );
  if (drafts[0] && sameOrderLines(drafts[0].lines, paid)) {
    await db.execute(
      sql`DELETE FROM order_drafts WHERE member_id = ${payment.member_id} AND cycle_id = ${a.cycleId}`,
    );
  }
  await audit(db, "stripe_order_payment", a.paymentId, {
    cycleId: a.cycleId,
    amountCents: a.amountCents,
    balanceCents: payment.balance_cents,
    walletCreditCents: payment.order_snapshot?.walletCreditCents ?? 0,
  });
  const { rows: cycles } = await db.execute<{ title: string }>(
    sql`SELECT title FROM order_cycles WHERE cycle_id = ${a.cycleId}`,
  );
  const s = payment.order_snapshot;
  const amount = formatMoney(a.amountCents / 100);
  const title = cycles[0]?.title ?? "";
  const main =
    s && typeof s.productsCents === "number"
      ? t.notificationsServer.orderPaidBody(
          title,
          amount,
          formatMoney(s.productsCents / 100),
          formatMoney(s.shippingCents / 100),
          formatMoney(s.feeCents / 100),
        )
      : t.notificationsServer.orderPaidShortBody(title, amount);
  // The wallet in the payment: the debt it paid, the credit it used.
  const wallet = [
    payment.balance_cents > 0 ? t.notificationsServer.orderPaidBalanceNote(formatMoney(payment.balance_cents / 100)) : null,
    (s?.walletCreditCents ?? 0) > 0
      ? t.notificationsServer.orderPaidCreditNote(formatMoney((s?.walletCreditCents ?? 0) / 100))
      : null,
  ].filter(Boolean);
  const body = [main, ...wallet].join(" ");
  await notifyMember(
    db,
    payment.member_id,
    "order_paid",
    t.notificationsServer.orderPaidTitle,
    () => body,
    `/ordine?cycleId=${a.cycleId}`,
  );
}

// `stripe` left out: this deploy's client; an explicit null means none.
export async function applyOrderCredit(a: OrderCreditAction, stripeArg?: RefundApi | null): Promise<void> {
  const stripe = stripeArg === undefined ? await getStripe() : stripeArg;
  const db = getDb();
  const before = await readPayment(db, a.paymentId);
  if (!before || before.kind !== "order" || before.cycle_id !== a.cycleId) {
    // Not an order payment of this app's database: nothing to credit.
    reportError("stripe order payment", new Error("paid session without its order payment row"), {
      paymentId: a.paymentId,
    });
    return;
  }

  if (await creditBatch(db, a, before, await debtParts(db, before))) {
    try {
      await afterCredit(db, a, before);
    } catch (e) {
      // The order and the credit are committed: never answer 500 for a notice.
      reportError("stripe order payment notices", e, { paymentId: a.paymentId });
    }
    return;
  }

  // The guard fired. Why?
  const row = await readPayment(db, a.paymentId);
  if (!row) return;
  // Already handled (a replayed event), unless the row was closed as failed or
  // expired while its Checkout was being created and the member paid anyway:
  // that money has no order, so it goes back like a late payment.
  const closedButPaid = CLOSED_UNPAID.has(row.status) && !(await isCredited(db, a.paymentId));
  if (row.status !== "pending" && !closedButPaid) return;
  const matches =
    row.amount_cents === a.amountCents &&
    row.currency === a.currency &&
    (row.checkout_session_id === null || row.checkout_session_id === a.sessionId);
  if (!matches) {
    reportError("stripe order payment", new Error("paid session does not match its payment row"), {
      paymentId: a.paymentId,
    });
    await audit(db, "stripe_order_mismatch", a.paymentId, {
      paid: { amountCents: a.amountCents, currency: a.currency, sessionId: a.sessionId },
      expected: { amountCents: row.amount_cents, currency: row.currency },
    });
    return;
  }
  const closedWithoutPayment = row.status !== "pending";
  const { rows: blockers } = await db.execute<{ cycle_open: boolean; missing: number }>(sql`
    SELECT
      (SELECT status FROM order_cycles WHERE cycle_id = ${a.cycleId}) = 'open' AS cycle_open,
      (SELECT count(*)::int FROM payments p, ${snapshotLines}
       WHERE p.payment_id = ${a.paymentId}
         AND NOT EXISTS (
           SELECT 1 FROM products pr
           WHERE pr.product_id = l."productId" AND pr.cycle_id = ${a.cycleId} AND pr.active
         )) AS missing
  `);
  const blocker = blockers[0];
  if (!closedWithoutPayment && blocker?.cycle_open && blocker.missing === 0) {
    // Nothing explains the refusal: let Stripe deliver the event again.
    throw new Error(`order payment ${a.paymentId} could not be credited`);
  }

  const refundId = await creditLate(db, a, await debtParts(db, row));
  if (!refundId) return; // a concurrent delivery took it
  await audit(db, "stripe_order_payment_late", a.paymentId, {
    cycleId: a.cycleId,
    amountCents: a.amountCents,
    cycleOpen: blocker?.cycle_open ?? false,
    missingProducts: blocker?.missing ?? 0,
  });
  try {
    // "retry" leaves the refund requested: Cassa shows it and sends it again.
    await sendRequestedRefund(refundId, stripe);
  } catch (e) {
    reportError("stripe late payment refund", e, { paymentId: a.paymentId, refundId });
  }
}

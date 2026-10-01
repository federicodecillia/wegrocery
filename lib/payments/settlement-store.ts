import { sql } from "drizzle-orm";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { dispatchWithBodies, getMemberEmails } from "@/lib/notifications/dispatch";
import { reportError } from "@/lib/observability";
import type { Db } from "./effects";
import { sendRequestedRefund, type RefundApi } from "./refund-request";
import { planMemberSettlement, type SettlementPayment, type SettlementPlan } from "./settlement";

// The database side of "Chiudi i conti" (lib/payments/settlement.ts has the
// rules): read each member's cycle net, write the refund requests and the
// write-offs in one guarded batch, then send the refunds to Stripe within a
// time budget. Running it again is always safe: what was asked for counts as
// already on its way, and a written-off cycle nets to zero.

export type MemberSettlement = {
  memberId: string;
  fullName: string;
  netCents: number;
  requestedCents: number;
  plan: SettlementPlan;
};

export type SettlementPreview = {
  cycle: { cycleId: string; title: string; status: string; paymentMode: string; settledAt: Date | null };
  members: MemberSettlement[];
  // net:requested per member, compared inside the batch.
  snapshot: Record<string, string>;
};

type MemberRow = { member_id: string; full_name: string; pays_offline: boolean; net: number; requested: number };
type PaymentRow = {
  payment_id: string;
  member_id: string;
  created_at: Date;
  amount_cents: number;
  refunded_cents: number;
  requested: number;
};

function memberNetsSql(cycleId: string) {
  return sql`
    SELECT m.member_id, m.full_name, m.pays_offline,
      coalesce((SELECT round(sum(l.amount) * 100) FROM ledger_entries l
                WHERE l.member_id = m.member_id AND l.cycle_id = ${cycleId}), 0)::integer AS net,
      coalesce((SELECT sum(r.amount_cents) FROM refunds r
                WHERE r.member_id = m.member_id AND r.cycle_id = ${cycleId} AND r.status = 'requested'), 0)::integer AS requested
    FROM members m
    WHERE m.member_id IN (
      SELECT member_id FROM ledger_entries WHERE cycle_id = ${cycleId}
      UNION SELECT member_id FROM payments WHERE cycle_id = ${cycleId}
    )`;
}

export async function previewSettlement(db: Db, cycleId: string): Promise<SettlementPreview> {
  const { rows: cycles } = await db.execute<{
    cycle_id: string;
    title: string;
    status: string;
    payment_mode: string;
    settled_at: Date | null;
  }>(sql`SELECT cycle_id, title, status, payment_mode, settled_at FROM order_cycles WHERE cycle_id = ${cycleId}`);
  const c = cycles[0];
  if (!c) throw new Error(`cycle ${cycleId} not found`);
  const [{ rows: memberRows }, { rows: paymentRows }] = await Promise.all([
    db.execute<MemberRow>(memberNetsSql(cycleId)),
    db.execute<PaymentRow>(sql`
      SELECT p.payment_id, p.member_id, p.created_at, p.amount_cents, p.refunded_cents,
        coalesce((SELECT sum(r.amount_cents) FROM refunds r
                  WHERE r.payment_id = p.payment_id AND r.status = 'requested'), 0)::integer AS requested
      FROM payments p
      WHERE p.cycle_id = ${cycleId} AND p.kind IN ('order', 'balance')
        AND p.status IN ('succeeded', 'partially_refunded', 'refunded')`),
  ]);
  const paymentsByMember = new Map<string, SettlementPayment[]>();
  for (const p of paymentRows) {
    const list = paymentsByMember.get(p.member_id) ?? [];
    list.push({
      paymentId: p.payment_id,
      createdAt: new Date(p.created_at),
      amountCents: p.amount_cents,
      refundedCents: p.refunded_cents,
      requestedCents: p.requested,
    });
    paymentsByMember.set(p.member_id, list);
  }
  const members = memberRows
    .map((m) => ({
      memberId: m.member_id,
      fullName: m.full_name,
      netCents: m.net,
      requestedCents: m.requested,
      plan: planMemberSettlement({
        memberId: m.member_id,
        netCents: m.net,
        requestedCents: m.requested,
        paysOffline: m.pays_offline,
        payments: paymentsByMember.get(m.member_id) ?? [],
      }),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    cycle: { cycleId: c.cycle_id, title: c.title, status: c.status, paymentMode: c.payment_mode, settledAt: c.settled_at },
    members,
    snapshot: Object.fromEntries(memberRows.map((m) => [m.member_id, `${m.net}:${m.requested}`])),
  };
}

function isGuardError(e: unknown): boolean {
  return e instanceof Error && /22012|division by zero/i.test(e.message);
}

export type SettleResult = {
  status: "settled" | "refunds_pending";
  refundsSent: number;
  refundsWaiting: number;
  writeOffs: number;
  due: number;
  excessCents: number;
};

export async function settleCycle(
  db: Db,
  cycleId: string,
  opts: { by: string; stripe: RefundApi | null; budgetMs?: number },
): Promise<SettleResult> {
  let preview: SettlementPreview | null = null;
  let writeOffs = 0;
  for (let attempt = 0; attempt < 3 && preview === null; attempt++) {
    const p = await previewSettlement(db, cycleId);
    if (p.cycle.paymentMode !== "per_order" || (p.cycle.status !== "closed" && p.cycle.status !== "cancelled")) {
      throw new Error(`cycle ${cycleId} is not closed or is not paid per order`);
    }
    const statements = [
      db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`),
      db.execute(sql`
        SELECT 1 / (CASE WHEN
          (SELECT status FROM order_cycles WHERE cycle_id = ${cycleId}) IN ('closed', 'cancelled')
          AND (SELECT coalesce(jsonb_object_agg(n.member_id, n.net || ':' || n.requested), '{}'::jsonb)
               FROM (${memberNetsSql(cycleId)}) n) = ${JSON.stringify(p.snapshot)}::jsonb
        THEN 1 ELSE 0 END) AS settle_guard`),
    ];
    let w = 0;
    for (const m of p.members) {
      if (m.plan.kind === "refund") {
        for (const r of m.plan.refunds) {
          statements.push(
            db.execute(sql`
              INSERT INTO refunds
                (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason, stripe_refund_id,
                 created_by, created_at, updated_at)
              SELECT 'settle_' || ${r.paymentId} || '_' || (
                       SELECT count(*) + 1 FROM refunds WHERE payment_id = ${r.paymentId} AND reason = 'settlement'),
                     ${r.paymentId}, ${m.memberId}, ${cycleId}, ${r.amountCents}, 'requested', 'settlement', NULL,
                     ${opts.by}, now(), now()`),
          );
        }
      }
      if (m.plan.kind === "writeOff") {
        w++;
        statements.push(
          db.execute(sql`
            INSERT INTO ledger_entries (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at)
            VALUES (${`led_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`}, ${m.memberId}, now(), 'correction',
                    ${m.plan.cents}::numeric / 100, ${cycleId}, ${t.ledger.writeOff}, ${opts.by}, now())`),
        );
      }
    }
    statements.push(db.execute(sql`UPDATE order_cycles SET settled_at = now() WHERE cycle_id = ${cycleId}`));
    try {
      await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
      preview = p;
      writeOffs = w;
    } catch (e) {
      if (!isGuardError(e)) throw e;
      // Something moved on the cycle meanwhile: read it again.
    }
  }
  if (!preview) throw new Error(`cycle ${cycleId} kept changing during the settlement`);

  // Every settlement refund of the cycle still waiting, this run's and any a
  // previous run could not send.
  const started = Date.now();
  const budget = opts.budgetMs ?? 240_000;
  const { rows: waiting } = await db.execute<{ refund_id: string }>(sql`
    SELECT refund_id FROM refunds WHERE cycle_id = ${cycleId} AND reason = 'settlement' AND status = 'requested'
    ORDER BY created_at, refund_id`);
  let sent = 0;
  let left = 0;
  for (const { refund_id } of waiting) {
    if (Date.now() - started > budget) {
      left++;
      continue;
    }
    try {
      const result = await sendRequestedRefund(refund_id, opts.stripe);
      if (result === "sent") sent++;
      else if (result === "retry") left++;
    } catch (e) {
      reportError("settlement refund", e, { refundId: refund_id });
      left++;
    }
  }

  const due = preview.members.filter((m) => m.plan.kind === "due");
  try {
    await notifyDue(db, preview.cycle.cycleId, preview.cycle.title, due);
  } catch (e) {
    reportError("settlement notices", e, { cycleId });
  }

  return {
    status: left > 0 ? "refunds_pending" : "settled",
    refundsSent: sent,
    refundsWaiting: left,
    writeOffs,
    due: due.length,
    excessCents: preview.members.reduce((s, m) => s + (m.plan.kind === "refund" ? m.plan.excessCents : 0), 0),
  };
}

// Each member who owes money hears it once per cycle and amount.
async function notifyDue(db: Db, cycleId: string, title: string, due: MemberSettlement[]): Promise<void> {
  if (due.length === 0) return;
  const href = `/ricarica?cycleId=${cycleId}`;
  const { rows: told } = await db.execute<{ member_id: string; body: string }>(sql`
    SELECT member_id, body FROM notifications WHERE type = 'settlement_due' AND href = ${href}`);
  const items = due
    .map((m) => {
      const amount = formatMoney((m.plan.kind === "due" ? m.plan.dueCents : 0) / 100);
      return { m, body: t.notificationsServer.settlementDueBody(title, amount) };
    })
    .filter(({ m, body }) => !told.some((r) => r.member_id === m.memberId && r.body === body));
  if (items.length === 0) return;
  const emails = await getMemberEmails(db, items.map(({ m }) => m.memberId));
  await dispatchWithBodies(
    db,
    items.map(({ m, body }) => ({
      memberId: m.memberId,
      email: emails.get(m.memberId) ?? null,
      title: t.notificationsServer.settlementDueTitle,
      body,
      href,
    })),
    "settlement_due",
    new Date(),
  );
}

// Where a closed pay-per-order cycle stands, as Admin → Ciclo shows it.
// A member's unpaid amount due does not count: it is theirs to pay.
export type SettlementStatus = "to_settle" | "refunds_pending" | "settled" | "needs_update" | "refund_failed";

export async function getSettlementStatus(db: Db, cycleId: string): Promise<SettlementStatus> {
  const [preview, { rows }] = await Promise.all([
    previewSettlement(db, cycleId),
    db.execute<{ waiting: number; failed: number }>(sql`
      SELECT count(*) FILTER (WHERE reason = 'settlement' AND status IN ('requested', 'pending'))::integer AS waiting,
             count(*) FILTER (WHERE status = 'failed')::integer AS failed
      FROM refunds WHERE cycle_id = ${cycleId}`),
  ]);
  // Money the card payments can still take back. What goes beyond them is
  // given back in Cassa, outside the cycle, so it never reopens it.
  const owedBack = preview.members.some((m) => m.plan.kind === "refund" && m.plan.refunds.length > 0);
  const toWriteOff = preview.members.some((m) => m.plan.kind === "writeOff");
  if ((rows[0]?.failed ?? 0) > 0 && owedBack) return "refund_failed";
  if (preview.cycle.settledAt === null) return "to_settle";
  if ((rows[0]?.waiting ?? 0) > 0) return "refunds_pending";
  if (owedBack || toWriteOff) return "needs_update";
  return "settled";
}

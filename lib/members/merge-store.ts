import { sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { ActionError } from "@/lib/action-error";
import { t } from "@/lib/i18n";
import { genId, type Db } from "@/lib/payments/effects";
import { mergedPlaceholderEmail, planMemberMerge, type MergeDecision, type MergeMode, type MergeState } from "./merge";

// Reads and writes of a member merge (rules in ./merge.ts). The write is ONE
// batch, so one transaction on the Neon HTTP driver:
// 1. lock both member rows FOR UPDATE: any insert that references either one
//    (an order, a movement, a payment, a notification) waits for the merge
//    (a foreign key takes KEY SHARE on the row it references);
// 2. lock the open cycles whose orders move, and require them still open
//    (saveOrder and the close take the same lock);
// 3. guard: the fingerprint of everything the plan was computed from is
//    unchanged, else the batch rolls back (division by zero) and the admin
//    is asked to retry;
// 4. move orders, drafts and notifications, post the balance pair, update the
//    survivor, delete or archive the absorbed account, drop the sign-in
//    identities of the addresses nobody keeps, write the audit row.

type Snapshot = { state: MergeState; fingerprint: string };

// Everything planMemberMerge depends on, as one text: computed when the plan
// is made and again inside the write batch.
function fingerprintSql(survivorId: string, absorbedId: string): SQL {
  return sql`concat_ws('|',
    (SELECT string_agg(concat_ws(',', member_id, lower(email), lower(alias_email), active, merged_into, household_of), ';' ORDER BY member_id)
       FROM members WHERE member_id IN (${survivorId}, ${absorbedId})),
    (SELECT count(*) FROM members WHERE household_of = ${absorbedId}),
    (SELECT concat_ws(',', count(*), coalesce(round(sum(amount) * 100), 0)) FROM ledger_entries WHERE member_id = ${absorbedId}),
    (SELECT concat_ws(',', count(*), count(*) FILTER (WHERE status = 'pending')) FROM payments WHERE member_id = ${absorbedId}),
    (SELECT count(*) FROM refunds WHERE member_id = ${absorbedId} AND status IN ('requested', 'pending')),
    (SELECT string_agg(concat_ws(',', o.cycle_id, c.status, o.n), ';' ORDER BY o.cycle_id)
       FROM (SELECT cycle_id, count(*) AS n FROM orders WHERE member_id = ${absorbedId} GROUP BY cycle_id) o
       JOIN order_cycles c ON c.cycle_id = o.cycle_id),
    (SELECT string_agg(DISTINCT o.cycle_id, ';')
       FROM orders o JOIN order_cycles c ON c.cycle_id = o.cycle_id
       WHERE o.member_id = ${survivorId} AND c.status = 'open'))`;
}

export async function readMergeState(
  db: Db,
  survivorId: string,
  absorbedId: string,
  actingMemberId: string | null,
): Promise<Snapshot | null> {
  const memberRows = await db.execute<{
    member_id: string;
    full_name: string;
    email: string;
    alias_email: string | null;
    active: boolean;
    merged_into: string | null;
    household_of: string | null;
  }>(sql`SELECT member_id, full_name, email, alias_email, active, merged_into, household_of
         FROM members WHERE member_id IN (${survivorId}, ${absorbedId})`);
  const toMember = (id: string) => {
    const r = memberRows.rows.find((m) => m.member_id === id);
    return r
      ? {
          memberId: r.member_id,
          fullName: r.full_name,
          email: r.email,
          aliasEmail: r.alias_email,
          active: r.active,
          mergedInto: r.merged_into,
          householdOf: r.household_of,
        }
      : null;
  };
  const survivor = toMember(survivorId);
  const absorbed = toMember(absorbedId);
  if (!survivor || !absorbed) return null;

  const [cycles, survivorOpen, counts] = await Promise.all([
    db.execute<{ cycle_id: string; title: string; status: string; payment_mode: string }>(
      sql`SELECT DISTINCT c.cycle_id, c.title, c.status, c.payment_mode
          FROM orders o JOIN order_cycles c ON c.cycle_id = o.cycle_id
          WHERE o.member_id = ${absorbedId} ORDER BY c.cycle_id`,
    ),
    db.execute<{ cycle_id: string }>(
      sql`SELECT DISTINCT o.cycle_id FROM orders o JOIN order_cycles c ON c.cycle_id = o.cycle_id
          WHERE o.member_id = ${survivorId} AND c.status = 'open'`,
    ),
    db.execute<{
      balance_cents: string;
      ledger_rows: string;
      payments: string;
      pending_payments: string;
      open_refunds: string;
      unsettled_per_order: string;
      household_members: string;
      fingerprint: string;
    }>(sql`SELECT
        (SELECT coalesce(round(sum(amount) * 100), 0) FROM ledger_entries WHERE member_id = ${absorbedId}) AS balance_cents,
        (SELECT count(*) FROM ledger_entries WHERE member_id = ${absorbedId}) AS ledger_rows,
        (SELECT count(*) FROM payments WHERE member_id = ${absorbedId}) AS payments,
        (SELECT count(*) FROM payments WHERE member_id = ${absorbedId} AND status = 'pending') AS pending_payments,
        (SELECT count(*) FROM refunds WHERE member_id = ${absorbedId} AND status IN ('requested', 'pending')) AS open_refunds,
        (SELECT count(DISTINCT l.cycle_id) FROM ledger_entries l JOIN order_cycles c ON c.cycle_id = l.cycle_id
          WHERE l.member_id = ${absorbedId} AND c.payment_mode = 'per_order' AND c.settled_at IS NULL) AS unsettled_per_order,
        (SELECT count(*) FROM members WHERE household_of = ${absorbedId}) AS household_members,
        ${fingerprintSql(survivorId, absorbedId)} AS fingerprint`),
  ]);
  const c = counts.rows[0];
  return {
    fingerprint: c.fingerprint,
    state: {
      survivor,
      absorbed,
      actingMemberId,
      absorbedOrderCycles: cycles.rows.map((r) => ({
        cycleId: r.cycle_id,
        title: r.title,
        status: r.status,
        paymentMode: r.payment_mode,
      })),
      survivorOpenOrderCycleIds: survivorOpen.rows.map((r) => r.cycle_id),
      absorbedBalanceCents: Number(c.balance_cents),
      absorbedLedgerRows: Number(c.ledger_rows),
      absorbedPayments: Number(c.payments),
      absorbedPendingPayments: Number(c.pending_payments),
      absorbedOpenRefunds: Number(c.open_refunds),
      absorbedUnsettledPerOrderCycles: Number(c.unsettled_per_order),
      absorbedHouseholdMembers: Number(c.household_members),
    },
  };
}

export type MergeResult = {
  deletedAbsorbed: boolean;
  transferCents: number;
  movedCycles: number;
  survivorAlias: string | null;
};

// Plans and writes the merge. A refusal comes back as the decision; a state
// that changed between the read and the write throws an ActionError.
// mode "link" (a member joining a family, lib/actions/family.ts) moves the
// same orders, drafts, notifications and balance, then points the person at
// the account instead of archiving them: addresses, preferences and earlier
// merges stay as they are. `adminEmail` is whoever acts (the invited member
// when linking).
export async function mergeMembers(
  db: Db,
  input: {
    survivorId: string;
    absorbedId: string;
    alias?: string | null;
    actingMemberId: string | null;
    adminEmail: string;
    mode?: MergeMode;
    // Link only: the invitation being accepted, marked accepted in the batch.
    inviteId?: string;
  },
): Promise<{ decision: MergeDecision; result?: MergeResult }> {
  const { survivorId, absorbedId } = input;
  const mode = input.mode ?? "merge";
  const link = mode === "link";
  const snapshot = await readMergeState(db, survivorId, absorbedId, input.actingMemberId);
  if (!snapshot) throw new ActionError(t.errors.memberNotFound);
  const decision = planMemberMerge(snapshot.state, input.alias, mode);
  if (!decision.ok) return { decision };
  const { plan } = decision;
  const { survivor, absorbed } = snapshot.state;
  const now = new Date();

  const statements: BatchItem<"pg">[] = [
    db.execute(sql`SELECT 1 FROM members WHERE member_id IN (${survivorId}, ${absorbedId}) ORDER BY member_id FOR UPDATE`),
  ];
  const moving = plan.moveCycleIds;
  const inMoving = sql.join(
    moving.map((id) => sql`${id}`),
    sql`, `,
  );
  if (moving.length > 0) {
    statements.push(
      db.execute(sql`SELECT 1 / (CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_guard
                     FROM order_cycles WHERE cycle_id IN (${inMoving}) ORDER BY cycle_id FOR UPDATE`),
    );
  }
  statements.push(
    db.execute(sql`SELECT 1 / (CASE WHEN ${fingerprintSql(survivorId, absorbedId)} = ${snapshot.fingerprint}
                                     THEN 1 ELSE 0 END) AS merge_guard`),
  );

  if (moving.length > 0) {
    // The survivor's drafts on those cycles were edits of no order: the
    // absorbed account's confirmed order is what moves there.
    statements.push(
      db.execute(sql`DELETE FROM order_drafts WHERE member_id = ${survivorId} AND cycle_id IN (${inMoving})`),
      db.execute(sql`UPDATE orders SET member_id = ${survivorId}, updated_at = ${now}
                     WHERE member_id = ${absorbedId} AND cycle_id IN (${inMoving})`),
    );
  }
  // A draft of the absorbed account moves unless the survivor already has an
  // order or a draft on that cycle.
  statements.push(
    db.execute(sql`DELETE FROM order_drafts d WHERE d.member_id = ${absorbedId}
                   AND (EXISTS (SELECT 1 FROM order_drafts s WHERE s.member_id = ${survivorId} AND s.cycle_id = d.cycle_id)
                        OR EXISTS (SELECT 1 FROM orders o WHERE o.member_id = ${survivorId} AND o.cycle_id = d.cycle_id))`),
    db.execute(sql`UPDATE order_drafts SET member_id = ${survivorId} WHERE member_id = ${absorbedId}`),
  );
  // A linked person keeps their own notifications (shown next to the account's).
  if (!link) statements.push(db.execute(sql`UPDATE notifications SET member_id = ${survivorId} WHERE member_id = ${absorbedId}`));
  // A linked person gets their preferences back if they leave the family.
  if (!link) statements.push(db.execute(sql`DELETE FROM notification_preferences WHERE member_id = ${absorbedId}`));

  if (plan.transferCents !== 0) {
    const outId = genId("led");
    const inId = genId("led");
    const amount = (plan.transferCents / 100).toFixed(2);
    const negated = (-plan.transferCents / 100).toFixed(2);
    statements.push(
      db.execute(sql`INSERT INTO ledger_entries
          (entry_id, member_id, entry_date, type, amount, note, created_by, created_at, counterpart)
        VALUES
          (${outId}, ${absorbedId}, ${now}, 'member_merge', ${negated}::numeric,
           ${link ? t.ledger.familyJoinOut(survivor.fullName) : t.ledger.memberMergeOut(survivor.fullName)},
           ${input.adminEmail}, ${now}, ${inId}),
          (${inId}, ${survivorId}, ${now}, 'member_merge', ${amount}::numeric,
           ${link ? t.ledger.familyJoinIn(absorbed.fullName) : t.ledger.memberMergeIn(absorbed.fullName)},
           ${input.adminEmail}, ${now}, ${outId})`),
    );
  }

  if (link) {
    statements.push(
      db.execute(sql`UPDATE members SET household_of = ${survivorId}, updated_at = ${now} WHERE member_id = ${absorbedId}`),
      // Every other invitation the person had is void now.
      db.execute(sql`UPDATE family_invites SET status = 'cancelled', responded_at = ${now}
                     WHERE status = 'pending' AND member_id = ${absorbedId}
                       AND invite_id IS DISTINCT FROM ${input.inviteId ?? null}`),
    );
    if (input.inviteId) {
      // Accepted only while still pending and unexpired, else the batch rolls back.
      statements.push(
        db.execute(sql`SELECT 1 / (SELECT count(*) FROM family_invites
                         WHERE invite_id = ${input.inviteId} AND status = 'pending' AND expires_at > now()
                           AND account_id = ${survivorId} AND member_id = ${absorbedId}) AS invite_guard`),
        db.execute(sql`UPDATE family_invites SET status = 'accepted', responded_at = ${now}
                       WHERE invite_id = ${input.inviteId}`),
      );
    }
  }
  // The survivor keeps its own card check unless the absorbed account was
  // checked more recently, and its last sign-in is the later of the two.
  if (!link) statements.push(
    db.execute(sql`UPDATE members a SET
        alias_email = ${plan.survivorAlias},
        last_login_at = GREATEST(a.last_login_at, b.last_login_at),
        membership_status = CASE WHEN b.membership_verified_at > coalesce(a.membership_verified_at, '-infinity')
                                 THEN b.membership_status ELSE a.membership_status END,
        membership_verified_at = GREATEST(a.membership_verified_at, b.membership_verified_at),
        updated_at = ${now}
      FROM members b
      WHERE a.member_id = ${survivorId} AND b.member_id = ${absorbedId}`),
  );
  // Accounts merged into the absorbed one earlier now point at the survivor.
  if (!link) statements.push(db.execute(sql`UPDATE members SET merged_into = ${survivorId} WHERE merged_into = ${absorbedId}`));
  if (!link) statements.push(
    plan.deleteAbsorbed
      ? db.execute(sql`DELETE FROM members WHERE member_id = ${absorbedId}`)
      : db.execute(sql`UPDATE members SET email = ${mergedPlaceholderEmail(absorbedId)}, alias_email = NULL,
                       active = false, merged_into = ${survivorId}, updated_at = ${now}
                       WHERE member_id = ${absorbedId}`),
  );
  if (plan.droppedAddresses.length > 0) {
    const dropped = sql.join(
      plan.droppedAddresses.map((a) => sql`${a}`),
      sql`, `,
    );
    statements.push(db.execute(sql`DELETE FROM auth_users WHERE lower(email) IN (${dropped})`));
  }
  const payload = {
    survivor: { memberId: survivorId, email: survivor.email, aliasEmail: survivor.aliasEmail },
    absorbed: { memberId: absorbedId, email: absorbed.email, aliasEmail: absorbed.aliasEmail, fullName: absorbed.fullName },
    plan,
  };
  statements.push(
    db.execute(sql`INSERT INTO audit_log (audit_id, user_email, action, entity_type, entity_id, payload_json, created_at)
      VALUES (${crypto.randomUUID()}, ${input.adminEmail}, ${link ? "join_family" : "merge_member"}, 'member', ${survivorId},
              ${JSON.stringify(payload)}, ${now})`),
  );

  try {
    await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (e) {
    // 22012 = division_by_zero: a guard fired, something changed meanwhile.
    if (e instanceof Error && /22012|division by zero/i.test(e.message)) {
      throw new ActionError(link ? t.family.changed : t.admin.members.merge.changed);
    }
    throw e;
  }

  return {
    decision,
    result: {
      deletedAbsorbed: plan.deleteAbsorbed,
      transferCents: plan.transferCents,
      movedCycles: moving.length,
      survivorAlias: plan.survivorAlias,
    },
  };
}

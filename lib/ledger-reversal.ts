import { sql, type SQL } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";

// The only way a movement is corrected once written (the ledger is
// append-only, drizzle/0023_ledger_append_only.sql): a 'reversal' row with the
// opposite amount cancels it, and, for an edit, a replacement row of the same
// type carries the right amount. All in ONE statement: the original is marked
// reversed (once: a second attempt finds it already reversed and writes
// nothing), the reversal and the replacement are inserted together. Both keep
// the original's date (when the money moved); created_at says when. The
// replacement does not repeat a bank reference: it stays on the original,
// still reserved against being recorded twice.

type Db = ReturnType<typeof getDb>;

export type ReverseInput = {
  entryId: string;
  note: string;
  by: string;
  replacement?: { amount: string; note: string };
};

export type ReverseResult = { reversalId: string; replacementId: string | null; memberId: string };

const newId = () => `led_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

// The statement, for callers that put it in their own batch.
export function reverseEntrySql(input: ReverseInput, ids = { reversalId: newId(), replacementId: newId() }): SQL {
  const replacement = input.replacement
    ? sql`,
      repl AS (
        INSERT INTO ledger_entries
          (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, method, replaces)
        SELECT ${ids.replacementId}, member_id, entry_date, type, ${input.replacement.amount}::numeric, cycle_id,
               ${input.replacement.note}, ${input.by}, now(), method, entry_id
        FROM orig
        RETURNING entry_id
      )`
    : sql``;
  return sql`
    WITH orig AS (
      UPDATE ledger_entries SET reversed_by = ${ids.reversalId}
      WHERE entry_id = ${input.entryId} AND reversed_by IS NULL AND type <> 'reversal'
      RETURNING entry_id, member_id, entry_date, type, amount, cycle_id, method
    ),
    rev AS (
      INSERT INTO ledger_entries
        (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, reverses)
      SELECT ${ids.reversalId}, member_id, entry_date, 'reversal', -amount, cycle_id, ${input.note}, ${input.by}, now(), entry_id
      FROM orig
      RETURNING entry_id, member_id
    )${replacement}
    SELECT rev.entry_id AS reversal_id, rev.member_id AS member_id,
           ${input.replacement ? sql`(SELECT entry_id FROM repl)` : sql`NULL::text`} AS replacement_id
    FROM rev`;
}

// null = the movement does not exist, is a reversal, or was already reversed.
export async function reverseEntry(db: Db, input: ReverseInput): Promise<ReverseResult | null> {
  const { rows } = await db.execute<{ reversal_id: string; member_id: string; replacement_id: string | null }>(
    reverseEntrySql(input),
  );
  const r = rows[0];
  return r ? { reversalId: r.reversal_id, replacementId: r.replacement_id, memberId: r.member_id } : null;
}

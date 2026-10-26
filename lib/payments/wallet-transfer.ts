import { sql, type SQL } from "drizzle-orm";
import { genId } from "./effects";

// Wallet credit used for a card cycle's order, or given back to the wallet
// (drizzle/0042_card_settles_wallet.sql): a pair of 'wallet_transfer' rows of
// the same member pointing at each other, one outside any cycle and one on
// the cycle, so the balance does not move while the wallet (the consolidated
// balance, lib/payments/balance-due.ts) and the cycle's coverage do. Nightly
// check: wallet_transfer_pairs.

export type WalletTransferDirection = "to_cycle" | "to_wallet";

// ONE statement. `cents` is evaluated once, in the statement's own snapshot,
// so a caller may pass what is available at that moment; zero or less writes
// nothing.
export function walletTransferSql(input: {
  memberId: string;
  cycleId: string;
  cents: SQL;
  direction: WalletTransferDirection;
  notes: { wallet: string; cycle: string };
  createdBy: string;
}): SQL {
  const walletId = genId("led");
  const cycleId = genId("led");
  const walletSign = input.direction === "to_cycle" ? -1 : 1;
  return sql`
    WITH amt AS (SELECT (${input.cents})::integer AS c)
    INSERT INTO ledger_entries
      (entry_id, member_id, entry_date, type, amount, cycle_id, note, created_by, created_at, counterpart)
    SELECT v.entry_id, ${input.memberId}, now(), 'wallet_transfer', (v.sign * amt.c)::numeric / 100, v.cycle_id,
           v.note, ${input.createdBy}, now(), v.counterpart
    FROM amt, (VALUES
      (${walletId}::text, ${walletSign}::integer, NULL::text, ${input.notes.wallet}::text, ${cycleId}::text),
      (${cycleId}::text, ${-walletSign}::integer, ${input.cycleId}::text, ${input.notes.cycle}::text, ${walletId}::text)
    ) AS v(entry_id, sign, cycle_id, note, counterpart)
    WHERE amt.c > 0`;
}

// What the member's wallet credit still covers on the cycle, in cents.
export function cycleWalletCreditCentsSql(memberId: string, cycleId: string): SQL {
  return sql`coalesce((SELECT round(sum(amount) * 100) FROM ledger_entries
    WHERE member_id = ${memberId} AND cycle_id = ${cycleId} AND type = 'wallet_transfer'), 0)::integer`;
}

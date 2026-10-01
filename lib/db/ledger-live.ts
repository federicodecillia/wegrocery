import { and, isNull, ne } from "drizzle-orm";
import { ledgerEntries } from "./schema";

// Ledger rows still in force: neither reversed nor a reversal
// (drizzle/0023_ledger_append_only.sql). Their sum equals the sum of all rows,
// so balances can use either; any filter by type must use these, or a
// corrected movement would count twice (original and replacement).
export const liveLedger = and(isNull(ledgerEntries.reversedBy), ne(ledgerEntries.type, "reversal"));

import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orderCycles } from "@/lib/db/schema";
import type { CycleHistoryEntry } from "@/lib/cycle-history";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { fillBankReference, paidByBankTransfer } from "./bank-reference";
import type { PaymentSettings } from "./settings";

// What a member needs to pay their orders by bank transfer: each order's
// reference, filled in from the template in Impostazioni, and where to send
// the receipt. Read by /ricarica and the History tab.
export type OrderBankReferences = {
  // cycleId -> the reference, only for the orders paid by bank transfer.
  references: Record<string, string>;
  receiptEmail: string | null;
};

// null when the group has the bank transfer off: no reference to show.
export async function getOrderBankReferences(
  settings: PaymentSettings,
  history: CycleHistoryEntry[],
  memberName: string,
  paysOffline: boolean,
): Promise<OrderBankReferences | null> {
  if (!settings.bankTransfer) return null;
  const owed = history.filter((o) => paidByBankTransfer(o, paysOffline));
  const references: Record<string, string> = {};
  if (owed.length > 0) {
    const dates = await getDb()
      .select({ cycleId: orderCycles.cycleId, orderCloseAt: orderCycles.orderCloseAt, createdAt: orderCycles.createdAt })
      .from(orderCycles)
      .where(inArray(orderCycles.cycleId, owed.map((o) => o.cycleId)));
    const dateOf = new Map(dates.map((d) => [d.cycleId, d.orderCloseAt ?? d.createdAt]));
    const template = settings.bankReferenceTemplate ?? t.topup.bankOrderReferenceDefault;
    for (const o of owed) {
      const date = dateOf.get(o.cycleId);
      if (!date) continue;
      references[o.cycleId] = fillBankReference(template, {
        order: o.title,
        month: formatDate(date, { month: "long" }),
        year: formatDate(date, { year: "numeric" }),
        member: memberName,
      });
    }
  }
  return { references, receiptEmail: settings.bankReceiptEmail };
}

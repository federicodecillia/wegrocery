import { AppShell } from "@/components/app-shell";
import { StoricoTabs } from "./storico-tabs";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getFamilyMemberIds, getMemberById, getMemberLedger, getMemberStorico } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { getWalletBalance } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { getOrderBankReferences } from "@/lib/payments/order-reference";
import { movementRecorder } from "@/lib/movement-label";
import { historyBadge } from "@/lib/cycle-history";
import { getMemberPickups } from "@/lib/db/pickups";
import type { Metadata } from "next";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.nav.history };

export default async function StoricoPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  // A family's account shows the history its people had before joining too.
  const historyIds = await getFamilyMemberIds(memberId);
  const [member, orderHistory, movements, settings, pickups] = await Promise.all([
    getMemberById(memberId),
    getMemberStorico(historyIds),
    getMemberLedger(historyIds),
    getPaymentSettings(),
    getMemberPickups(historyIds),
  ]);
  // The reference of each order paid by bank transfer, in its detail.
  const bankRefs = await getOrderBankReferences(
    settings,
    orderHistory,
    session.user.fullName ?? member?.fullName ?? session.user.email,
    member?.paysOffline ?? false,
  );
  // Without the card cycles not settled yet, like Home.
  const balance = await getWalletBalance(getDb(), memberId, member?.paysOffline ?? false);
  // Worked out here, so the badge does not depend on the device's clock.
  const now = new Date();

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId} layout="wide">
      <StoricoTabs
        orderHistory={orderHistory.map((o) => {
          const pickup = pickups.get(o.cycleId);
          const pickedUpAt = o.status === "closed" ? (pickup?.pickedUpAt ?? null) : null;
          return {
            ...o,
            pickedUpAt: pickedUpAt?.toISOString() ?? null,
            collectedBy: pickedUpAt ? (pickup?.collectedBy ?? null) : null,
            badge: historyBadge({ ...o, pickedUpAt }, now),
          };
        })}
        movements={movements.map((e) => ({
          entryId: e.entryId,
          type: e.type,
          amount: e.amount,
          note: e.note,
          entryDate: e.entryDate,
          paymentId: e.paymentId,
          cycleId: e.cycleId,
          cycleTitle: e.cycleTitle,
          method: e.method,
          externalRef: e.externalRef,
          correctedAt: e.correctedAt ? new Date(e.correctedAt).toISOString() : null,
          paymentStatus: e.paymentStatus,
          recordedBy: movementRecorder(e),
        }))}
        balance={balance}
        bankRefs={bankRefs}
      />
    </AppShell>
  );
}

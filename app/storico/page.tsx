import { AppShell } from "@/components/app-shell";
import { StoricoTabs } from "./storico-tabs";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getFamilyMemberIds, getMemberById, getMemberLedger, getMemberStorico } from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { getWalletBalance } from "@/lib/payments/balance-due";
import { movementRecorder } from "@/lib/movement-label";

export default async function StoricoPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  // A family's account shows the history its people had before joining too.
  const historyIds = await getFamilyMemberIds(memberId);
  const [member, orderHistory, movements] = await Promise.all([
    getMemberById(memberId),
    getMemberStorico(historyIds),
    getMemberLedger(historyIds),
  ]);
  // Without the card cycles not settled yet, like Home.
  const balance = await getWalletBalance(getDb(), memberId, member?.paysOffline ?? false);

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
      <StoricoTabs
        orderHistory={orderHistory}
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
      />
    </AppShell>
  );
}

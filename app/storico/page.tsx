import { AppShell } from "@/components/app-shell";
import { StoricoTabs } from "./storico-tabs";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getFamilyMemberIds, getMemberBalance, getMemberLedger, getMemberStorico } from "@/lib/db/queries";
import { movementRecorder } from "@/lib/movement-label";

export default async function StoricoPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  // A family's account shows the history its people had before joining too.
  const historyIds = await getFamilyMemberIds(memberId);
  const [balance, orderHistory, movements] = await Promise.all([
    getMemberBalance(memberId),
    getMemberStorico(historyIds),
    getMemberLedger(historyIds),
  ]);

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
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

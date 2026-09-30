import { AppShell } from "@/components/app-shell";
import { StoricoTabs } from "./storico-tabs";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getMemberBalance, getMemberLedger, getMemberStorico } from "@/lib/db/queries";
import { movementRecorder } from "@/lib/movement-label";

export default async function StoricoPage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, orderHistory, movements] = await Promise.all([
    getMemberBalance(memberId),
    getMemberStorico(memberId),
    getMemberLedger(memberId),
  ]);

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
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
          paymentStatus: e.paymentStatus,
          recordedBy: movementRecorder(e),
        }))}
        balance={balance}
      />
    </AppShell>
  );
}

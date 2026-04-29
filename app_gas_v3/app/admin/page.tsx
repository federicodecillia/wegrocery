import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { TabCiclo } from "@/components/admin/tab-ciclo";
import { TabProdotti } from "@/components/admin/tab-prodotti";
import { TabOrdini } from "@/components/admin/tab-ordini";
import { TabCassa } from "@/components/admin/tab-cassa";
import { TabSoci } from "@/components/admin/tab-soci";

type SearchParams = Promise<{
  tab?: string;
  cycle?: string;
  member?: string;
}>;

function TabSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-black/[0.05]"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUserSession();
  const role = getUserRole(session);
  if (role !== "admin") redirect("/");

  const { tab: tabParam, cycle: cycleId, member: memberId } = await searchParams;
  const tab = tabParam ?? "ciclo";

  return (
    <AppShell email={session.user.email} isAdmin>
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>

      <Suspense key={`${tab}-${cycleId ?? ""}-${memberId ?? ""}`} fallback={<TabSkeleton />}>
        {tab === "ciclo" && <TabCiclo />}
        {tab === "prodotti" && <TabProdotti />}
        {tab === "ordini" && <TabOrdini cycleId={cycleId} />}
        {tab === "cassa" && <TabCassa memberId={memberId} />}
        {tab === "soci" && <TabSoci />}
      </Suspense>
    </AppShell>
  );
}

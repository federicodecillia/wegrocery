import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { checkAccess } from "@/lib/auth/access";
import { requireUserSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { TabCiclo } from "@/components/admin/tab-ciclo";
import { TabProdotti } from "@/components/admin/tab-prodotti";
import { TabOrdini } from "@/components/admin/tab-ordini";
import { TabCassa } from "@/components/admin/tab-cassa";
import { TabSoci } from "@/components/admin/tab-soci";
import { TabFornitori } from "@/components/admin/tab-fornitori";
import { TabStatistiche } from "@/components/admin/tab-statistiche";
import { TabImpostazioni } from "@/components/admin/tab-impostazioni";

type SearchParams = Promise<{
  tab?: string;
  cycle?: string;
  member?: string;
  supplier?: string;
  balance?: string;
}>;

function parseCsvParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
  // Same rule as proxy.ts and requireAdmin: role admin and an active member.
  if (!checkAccess(session.user, "admin").ok) redirect("/");

  const {
    tab: tabParam,
    cycle: cycleId,
    member: filterMemberId,
    supplier: filterSupplierId,
    balance: balanceParam,
  } = await searchParams;
  const tab = tabParam ?? "ciclo";
  const balanceFilter =
    balanceParam === "negative" || balanceParam === "above_max" ? balanceParam : undefined;

  return (
    <AppShell email={session.user.email} isAdmin memberId={session.user.memberId!} personId={session.user.personId} width="admin">
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>

      <Suspense
        key={`${tab}-${cycleId ?? ""}-${filterMemberId ?? ""}-${filterSupplierId ?? ""}-${balanceFilter ?? ""}`}
        fallback={<TabSkeleton />}
      >
        {tab === "ciclo" && <TabCiclo />}
        {tab === "prodotti" && <TabProdotti />}
        {tab === "ordini" && <TabOrdini cycleId={cycleId} memberId={filterMemberId} />}
        {tab === "cassa" && <TabCassa balanceFilter={balanceFilter} />}
        {tab === "fornitori" && <TabFornitori />}
        {tab === "soci" && <TabSoci />}
        {tab === "statistiche" && (
          <TabStatistiche
            cycleIds={parseCsvParam(cycleId)}
            supplierIds={parseCsvParam(filterSupplierId)}
            memberIds={parseCsvParam(filterMemberId)}
          />
        )}
        {tab === "impostazioni" && <TabImpostazioni />}
      </Suspense>
    </AppShell>
  );
}

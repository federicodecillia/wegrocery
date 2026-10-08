import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { checkAccess } from "@/lib/auth/access";
import { requireUserSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { CycleWorkspace } from "@/components/admin/cycle-workspace";
import { TabProdotti } from "@/components/admin/tab-prodotti";
import { TabCassa } from "@/components/admin/tab-cassa";
import { TabSoci } from "@/components/admin/tab-soci";
import { TabFornitori } from "@/components/admin/tab-fornitori";
import { TabStatistiche } from "@/components/admin/tab-statistiche";
import { TabImpostazioni } from "@/components/admin/tab-impostazioni";
import type { Metadata } from "next";
import { adminTitle, resolveAdminRoute } from "@/lib/admin/nav";
import type { CycleView } from "@/lib/admin/cycle-views";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { tab, view } = await searchParams;
  return { title: `${adminTitle(tab, view)} · Admin` };
}

type SearchParams = Promise<{
  tab?: string;
  view?: string;
  cycle?: string;
  member?: string;
  supplier?: string;
  balance?: string;
  new?: string;
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
    view: viewParam,
    cycle: cycleId,
    member: filterMemberId,
    supplier: filterSupplierId,
    balance: balanceParam,
    new: newParam,
  } = await searchParams;
  const { section, view } = resolveAdminRoute(tabParam, viewParam);
  const balanceFilter =
    balanceParam === "negative" || balanceParam === "above_max" ? balanceParam : undefined;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin memberId={session.user.memberId!} personId={session.user.personId} width="admin">
      <h1 className="sr-only">{`Admin: ${adminTitle(tabParam, viewParam)}`}</h1>
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>

      <Suspense
        key={`${section}-${view ?? ""}-${newParam ?? ""}-${cycleId ?? ""}-${filterMemberId ?? ""}-${filterSupplierId ?? ""}-${balanceFilter ?? ""}`}
        fallback={<TabSkeleton />}
      >
        {section === "ciclo" && (
          <CycleWorkspace
            cycleId={cycleId}
            view={view as CycleView | null}
            memberId={filterMemberId}
            creating={newParam === "1"}
          />
        )}
        {view === "prodotti" && <TabProdotti />}
        {view === "fornitori" && <TabFornitori />}
        {section === "cassa" && <TabCassa balanceFilter={balanceFilter} />}
        {section === "soci" && <TabSoci />}
        {section === "statistiche" && (
          <TabStatistiche
            cycleIds={parseCsvParam(cycleId)}
            supplierIds={parseCsvParam(filterSupplierId)}
            memberIds={parseCsvParam(filterMemberId)}
          />
        )}
        {section === "impostazioni" && <TabImpostazioni />}
      </Suspense>
    </AppShell>
  );
}

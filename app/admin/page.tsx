import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { adminAccess } from "@/lib/auth/access";
import { requireUserSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { CycleWorkspace } from "@/components/admin/cycle-workspace";
import { TabProdotti } from "@/components/admin/tab-prodotti";
import { TabCassa } from "@/components/admin/tab-cassa";
import { TabSoci } from "@/components/admin/tab-soci";
import { TabFornitori } from "@/components/admin/tab-fornitori";
import { TabStatistiche } from "@/components/admin/tab-statistiche";
import { TabImpostazioni } from "@/components/admin/tab-impostazioni";
import { SetupBanner } from "@/components/admin/setup/setup-banner";
import { AdminWelcome } from "@/components/admin/admin-welcome";
import { ADMIN_WELCOME_QUERY } from "@/lib/admin/welcome";
import type { Metadata } from "next";
import { adminTitle, resolveAdminRoute, sectionAllowed, type SettingsView } from "@/lib/admin/nav";
import { normalizeRole } from "@/lib/roles";
import type { CycleView } from "@/lib/admin/cycle-views";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { tab, view, member, cycle } = await searchParams;
  return { title: `${adminTitle(tab, view, member, cycle)} · Admin` };
}

type SearchParams = Promise<{
  tab?: string;
  view?: string;
  cycle?: string;
  member?: string;
  supplier?: string;
  balance?: string;
  new?: string;
  benvenuto?: string;
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
          className="h-24 animate-pulse rounded-xl bg-tint/[0.05]"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUserSession();
  // Same rule as requireAdmin / requireOrderManager: an active admin, or an
  // active "Referente ordini" for the limited area (lib/admin/nav.ts).
  const access = adminAccess(session.user);
  if (!access) redirect("/");

  const {
    tab: tabParam,
    view: viewParam,
    cycle: cycleId,
    member: filterMemberId,
    supplier: filterSupplierId,
    balance: balanceParam,
    new: newParam,
    [ADMIN_WELCOME_QUERY]: welcomeParam,
  } = await searchParams;
  const route = resolveAdminRoute(tabParam, viewParam, filterMemberId, cycleId);
  // A section a referent cannot open falls back to the cycles.
  const { section, view } = sectionAllowed(route.section, access) ? route : { section: "ciclo" as const, view: null };
  const referent = access === "referent";
  const balanceFilter =
    balanceParam === "negative" || balanceParam === "above_max" ? balanceParam : undefined;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} admin={adminAccess(session.user)} memberId={session.user.memberId!} personId={session.user.personId} layout="wide">
      <h1 className="sr-only">{`Admin: ${adminTitle(tabParam, viewParam, filterMemberId, cycleId)}`}</h1>
      <Suspense fallback={null}>
        <AdminNav access={access} />
      </Suspense>
      {!referent && <SetupBanner />}
      {!referent && section === "ciclo" && !view && !cycleId && newParam !== "1" && (
        <Suspense fallback={null}>
          <AdminWelcome personId={session.user.personId ?? session.user.memberId!} reopened={welcomeParam === "1"} />
        </Suspense>
      )}

      <Suspense
        key={`${section}-${view ?? ""}-${newParam ?? ""}-${cycleId ?? ""}-${filterMemberId ?? ""}-${filterSupplierId ?? ""}-${balanceFilter ?? ""}`}
        fallback={<TabSkeleton />}
      >
        {section === "ciclo" && (
          <CycleWorkspace
            cycleId={cycleId}
            view={view as CycleView | null}
            creating={newParam === "1"}
            access={access}
            role={normalizeRole(session.user.role)}
          />
        )}
        {view === "prodotti" && <TabProdotti supplierId={filterSupplierId} />}
        {view === "fornitori" && <TabFornitori />}
        {section === "cassa" && <TabCassa balanceFilter={balanceFilter} memberId={filterMemberId} />}
        {section === "soci" && <TabSoci memberId={referent ? undefined : filterMemberId} readOnly={referent} />}
        {section === "statistiche" && (
          <TabStatistiche
            cycleIds={parseCsvParam(cycleId)}
            supplierIds={parseCsvParam(filterSupplierId)}
            memberIds={parseCsvParam(filterMemberId)}
          />
        )}
        {section === "impostazioni" && <TabImpostazioni view={view as SettingsView} />}
      </Suspense>
    </AppShell>
  );
}

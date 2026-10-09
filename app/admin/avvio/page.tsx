import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ConfigStatusCard } from "@/components/admin/config-status-card";
import { GroupInfoCard } from "@/components/admin/group-info-card";
import { FinishSetup } from "@/components/admin/setup/finish-setup";
import { SetupChecks } from "@/components/admin/setup/setup-checks";
import { IdentitySection, PaymentSettingsSection } from "@/components/admin/tab-impostazioni";
import { SETUP_STEPS, setupHref, stepIndex } from "@/lib/admin/setup-steps";
import { checkAccess } from "@/lib/auth/access";
import { requireUserSession } from "@/lib/auth/session";
import { getConfigStatus } from "@/lib/config-status-server";
import { getAppBaseUrl } from "@/lib/email/base-url";
import { t } from "@/lib/i18n";
import { getPaymentSettings } from "@/lib/payments/get-settings";

export const metadata: Metadata = { title: `${t.admin.setup.pageTitle} · Admin` };

// The first-run setup of a new group: the same forms as Admin → Impostazioni,
// one step at a time, then the checks of what the deploy has connected. Any
// step can be skipped; Admin offers the setup until an admin finishes it
// (group_identity.setup_completed_at).
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const session = await requireUserSession();
  if (!checkAccess(session.user, "admin").ok) redirect("/");
  const index = stepIndex((await searchParams).step);
  const step = SETUP_STEPS[index];
  const s = t.admin.setup;
  const prev = index > 0 ? SETUP_STEPS[index - 1] : null;
  const next = index < SETUP_STEPS.length - 1 ? SETUP_STEPS[index + 1] : null;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin memberId={session.user.memberId!} personId={session.user.personId}>
      <p className="font-mono text-label uppercase tracking-[0.1em] text-brand-gray">{s.stepOf(index + 1, SETUP_STEPS.length)}</p>
      <h1 className="mt-1 text-title font-black text-brand-near-black">{s.steps[step]}</h1>
      {index === 0 && <p className="mt-2 text-[14px] text-brand-gray">{s.intro}</p>}

      <nav aria-label={s.pageTitle} className="mt-4">
        <ol className="flex flex-wrap gap-2">
          {SETUP_STEPS.map((id, i) => (
            <li key={id}>
              <Link
                href={setupHref(id)}
                aria-current={i === index ? "step" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1 text-[12px] font-bold ${
                  i === index ? "border-primary bg-primary text-on-primary" : "border-brand-border bg-white text-brand-near-black"
                }`}
              >
                {i + 1}. {s.steps[id]}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-5 space-y-4">
        <StepContent step={step} adminEmail={session.user.email} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 pb-6">
        {prev ? (
          <Link href={setupHref(prev)} className="inline-flex min-h-11 items-center rounded-full border border-brand-border bg-white px-5 py-2 text-[14px] font-bold text-brand-near-black">
            {s.back}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={setupHref(next)} className="inline-flex min-h-11 items-center rounded-full bg-brand-near-black px-5 py-2 text-[14px] font-bold text-white">
            {s.next}
          </Link>
        )}
      </div>
    </AppShell>
  );
}

async function StepContent({ step, adminEmail }: { step: (typeof SETUP_STEPS)[number]; adminEmail: string }) {
  switch (step) {
    case "identity":
      return <IdentitySection section="identity" />;
    case "contacts":
      return <IdentitySection section="contacts" />;
    case "payments":
      return <PaymentSettingsSection />;
    case "group": {
      const settings = await getPaymentSettings();
      return <GroupInfoCard key={settings.groupInfo ?? ""} initial={settings.groupInfo} />;
    }
    case "checks": {
      const base = getAppBaseUrl();
      return (
        <>
          <SetupChecks adminEmail={adminEmail} webhookUrl={base ? `${base}/api/stripe/webhook` : null} />
          <ConfigStatusCard items={await getConfigStatus()} />
        </>
      );
    }
    case "finish":
      return <FinishSetup />;
  }
}

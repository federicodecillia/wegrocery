import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { StepChecklist } from "@/components/step-checklist";
import { Badge, Card, Notice, PageTitle, SectionTitle } from "@/components/ui";
import { requireOperator } from "@/lib/auth/session";
import { getInstance, getRequest, listSteps } from "@/lib/db/queries";
import type { Instance } from "@/lib/db/schema";
import { env, missingProviderTokens } from "@/lib/env";
import { mailConfigured } from "@/lib/mail";
import { domainDnsRecord } from "@/lib/providers/vercel";
import { webhookUrl } from "@/lib/providers/stripe";
import { handoverText } from "@/lib/provisioning/handover";
import { emailDomainStatus } from "@/lib/provisioning/runner";
import { canReopen, canRun, canSkip, currentStep, isStepId, stepDef, stepStates, type StepId, type StepStates } from "@/lib/provisioning/steps";
import {
  createAppAction,
  createDatabaseAction,
  createEmailDomainAction,
  finishEmailAction,
  completeHandoverAction,
  sendHandoverAction,
  skipStepAction,
  verifyEmailDomainAction,
} from "./actions";
import { ActionButton, CopyButton, DnsRecords, DomainForm, EmailModeForm, IdentityStep, PublishPanel, RegistryStep, StripeForm } from "./steps";

export const metadata: Metadata = { title: "Nuovo gruppo" };

type Search = { istanza?: string; passo?: string; richiesta?: string };

export default async function NewGroupPage(props: { searchParams: Promise<Search> }) {
  await requireOperator();
  const sp = await props.searchParams;
  const missing = missingProviderTokens();

  if (!sp.istanza) {
    const request = sp.richiesta ? await getRequest(sp.richiesta) : null;
    return (
      <Shell current="/nuovo">
        <PageTitle title="Nuovo gruppo" subtitle={request ? `Dalla richiesta di ${request.groupName}` : "Passo 1 di 9: anagrafica"} />
        {missing.length > 0 && <Notice tone="warn" className="mb-4">Mancano {missing.join(", ")}: i passi che li usano falliranno.</Notice>}
        <Card className="max-w-3xl">
          <SectionTitle>1. Anagrafica</SectionTitle>
          <RegistryStep
            instanceId={null}
            locked={false}
            defaults={{
              name: request?.groupName ?? "",
              slug: "",
              adminEmail: request?.contactEmail ?? "",
              locale: request?.locale === "en" ? "en" : "it",
              currency: request?.currency ?? "EUR",
              timeZone: request?.timeZone ?? "Europe/Rome",
              hostingModel: request?.hostingPreference ?? "managed",
              vercelTeamId: "",
              vercelTeamSlug: "",
              neonOrgId: "",
              requestId: request?.id ?? null,
            }}
          />
        </Card>
      </Shell>
    );
  }

  const instance = await getInstance(sp.istanza);
  if (!instance) notFound();
  const rows = await listSteps(instance.id);
  const states = stepStates(rows);
  const current = currentStep(states);
  const requested = sp.passo && isStepId(sp.passo) ? sp.passo : null;
  const active: StepId = requested && (canRun(requested, states) || states[requested] !== "todo") ? requested : (current ?? "consegna");
  const details = Object.fromEntries(rows.map((r) => [r.step, r.detail])) as Partial<Record<StepId, string | null>>;

  return (
    <Shell current="/nuovo">
      <PageTitle
        title={instance.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Creazione dell&apos;istanza <span className="font-mono">{instance.slug}</span>
            <Link href={`/istanze/${instance.id}`} className="underline underline-offset-2">
              scheda istanza
            </Link>
          </span>
        }
      />
      {missing.length > 0 && <Notice tone="warn" className="mb-4">Mancano {missing.join(", ")}: i passi che li usano falliranno.</Notice>}
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <StepChecklist states={states} current={active} instanceId={instance.id} />
        </Card>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle className="mb-0">{stepDef(active).label}</SectionTitle>
            <StatusBadge status={states[active]} />
          </div>
          {details[active] && states[active] !== "todo" && (
            <Notice tone={states[active] === "failed" ? "danger" : "neutral"} className="mb-4 break-words">
              {details[active]}
            </Notice>
          )}
          <StepPanel step={active} instance={instance} states={states} />
        </Card>
      </div>
    </Shell>
  );
}

function StatusBadge({ status }: { status: StepStates[StepId] }) {
  const map = { todo: ["Da fare", "neutral"], done: ["Fatto", "ok"], failed: ["Fallito", "danger"], skipped: ["Saltato", "neutral"] } as const;
  const [label, tone] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function retryLabel(states: StepStates, step: StepId, first: string) {
  return states[step] === "failed" ? "Riprova" : states[step] === "done" ? "Esegui di nuovo" : first;
}

async function StepPanel({ step, instance, states }: { step: StepId; instance: Instance; states: StepStates }) {
  const id = instance.id;
  const w = instance.wizard;
  if (!canRun(step, states)) return <p className="text-sm text-muted">Completa prima i passi precedenti.</p>;

  switch (step) {
    case "anagrafica":
      return (
        <RegistryStep
          instanceId={id}
          locked={!canReopen("anagrafica", states)}
          defaults={{
            name: instance.name,
            slug: instance.slug,
            adminEmail: w.adminEmail ?? "",
            locale: w.locale ?? "it",
            currency: w.currency ?? "EUR",
            timeZone: w.timeZone ?? "Europe/Rome",
            hostingModel: instance.hostingModel,
            vercelTeamId: instance.vercelTeamId ?? "",
            vercelTeamSlug: instance.vercelTeamSlug ?? "",
            neonOrgId: instance.neonOrgId ?? "",
            requestId: instance.requestId,
          }}
        />
      );

    case "identita":
      return (
        <IdentityStep
          instanceId={id}
          locked={!canReopen("identita", states)}
          defaults={{
            appName: w.appName ?? instance.name,
            shortName: w.shortName ?? instance.name.slice(0, 12),
            primary: w.primary ?? "",
            accent: w.accent ?? "",
            logoUrl: w.logoUrl ?? "",
          }}
        />
      );

    case "database":
      return (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Crea il progetto Neon <span className="font-mono">wegrocery-{instance.slug}</span> (Postgres 17, Francoforte
            aws-eu-central-1){instance.neonOrgId ? ` nell'organizzazione ${instance.neonOrgId}` : ""}.
          </p>
          {instance.neonProjectId && <p>Progetto: <span className="font-mono">{instance.neonProjectId}</span></p>}
          <div>
            <ActionButton action={createDatabaseAction.bind(null, id)} label={retryLabel(states, "database", "Crea il database")} variant="primary" />
          </div>
        </div>
      );

    case "app":
      return (
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Crea il progetto Vercel <span className="font-mono">wegrocery-{instance.slug}</span> collegato a{" "}
            <span className="font-mono">{env.repo()}</span> (Next.js, branch main) e scrive in un solo passaggio le variabili:
            DATABASE_URL (letta ora da Neon, solo produzione), AUTH_SECRET e INSTANCE_STATS_SECRET (generati), BOOTSTRAP_ADMIN_EMAIL,
            APP_BASE_URL, MIGRATE_ON_BUILD=true (solo produzione), NEXT_PUBLIC_BRAND_JSON, NEXT_PUBLIC_TIME_ZONE.
          </p>
          <p className="text-muted">
            I segreti vanno su Vercel come «sensitive» e non passano dal database della console; il segreto delle statistiche viene
            conservato cifrato. Rieseguire il passo rigenera AUTH_SECRET: fallo solo prima della consegna.
          </p>
          {instance.hostingModel === "group_owned" && (
            <Notice tone="warn">
              Account del gruppo: il team Vercel del gruppo deve avere accesso al repository su GitHub (app Vercel installata), altrimenti
              il collegamento fallisce.
            </Notice>
          )}
          {instance.vercelProjectId && <p>Progetto: <span className="font-mono">{instance.vercelProjectId}</span> · {instance.url}</p>}
          <div>
            <ActionButton action={createAppAction.bind(null, id)} label={retryLabel(states, "app", "Crea l'app e scrivi le variabili")} variant="primary" />
          </div>
        </div>
      );

    case "email":
      return <EmailPanel instance={instance} states={states} />;

    case "pagamenti":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Facoltativo. Serve la chiave dell&apos;account Stripe <strong>del gruppo</strong> (mai quello dell&apos;operatore). La
            console crea il webhook con gli eventi richiesti dall&apos;app e scrive STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET su
            Vercel; non conserva nulla.
          </p>
          {w.paymentsConfigured && <Notice tone="ok">Configurati ({w.stripeMode === "live" ? "live" : "test"}).</Notice>}
          <StripeForm instanceId={id} webhookUrl={webhookUrl(instance.url)} />
          {canSkip("pagamenti", states) && (
            <div>
              <ActionButton action={skipStepAction.bind(null, id, "pagamenti")} label="Salta: niente pagamenti online" variant="ghost" />
            </div>
          )}
        </div>
      );

    case "pubblica":
      return <PublishPanel instanceId={id} deploymentId={w.deploymentId ?? null} done={states.pubblica === "done"} />;

    case "dominio": {
      const rec = w.customDomain ? domainDnsRecord(w.customDomain) : null;
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm">Facoltativo. Senza dominio l&apos;app resta su {instance.url}.</p>
          {w.customDomain && rec && (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Dominio <span className="font-mono">{w.customDomain}</span>: il gruppo aggiunge questo record DNS, poi ridistribuisci
                (APP_BASE_URL è già aggiornata) e cambia l&apos;URL nella scheda dell&apos;istanza quando risponde.
              </p>
              <p className="font-mono text-xs">
                {rec.type} {rec.name} → {rec.value}
              </p>
              <div>
                <CopyButton text={`${rec.type}\t${rec.name}\t${rec.value}`} label="Copia il record" />
              </div>
            </div>
          )}
          <DomainForm instanceId={id} />
          {canSkip("dominio", states) && (
            <div>
              <ActionButton action={skipStepAction.bind(null, id, "dominio")} label="Salta: resta su vercel.app" variant="ghost" />
            </div>
          )}
        </div>
      );
    }

    case "consegna": {
      const text = handoverText({
        groupName: instance.name,
        appUrl: instance.url,
        adminEmail: w.adminEmail ?? "",
        emailOnSharedDomain: w.emailMode === "shared_domain",
        paymentsConfigured: Boolean(w.paymentsConfigured),
      });
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Il testo da mandare al primo admin ({w.adminEmail}):</p>
          <textarea readOnly value={text} rows={16} className="w-full rounded-lg border border-line bg-bg p-3 font-mono text-xs" aria-label="Testo per l'admin" />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} label="Copia il testo" />
            {mailConfigured() && (
              <ActionButton action={sendHandoverAction.bind(null, id)} label={w.handoverSentAt ? "Invia di nuovo via email" : "Invia via email"} />
            )}
            <ActionButton action={completeHandoverAction.bind(null, id)} label="Segna come consegnata" variant="primary" />
          </div>
        </div>
      );
    }
  }
}

async function EmailPanel({ instance, states }: { instance: Instance; states: StepStates }) {
  const id = instance.id;
  const w = instance.wizard;
  const status = instance.resendDomainId ? await emailDomainStatus(id) : null;
  const domainStatus = status?.ok ? status.status : null;

  return (
    <div className="flex flex-col gap-5">
      <EmailModeForm instanceId={id} mode={w.emailMode ?? null} domain={w.emailDomain ?? ""} sharedDomain={env.sharedMailDomain()} />

      {w.emailMode === "group_domain" && w.emailDomain && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm font-medium">Dominio {w.emailDomain} su Resend (regione eu-west-1)</p>
          {!instance.resendDomainId && (
            <div>
              <ActionButton action={createEmailDomainAction.bind(null, id)} label="Crea il dominio su Resend" variant="primary" />
            </div>
          )}
          {status && !status.ok && <Notice tone="danger">{status.error}</Notice>}
          {status?.ok && (
            <>
              <p className="text-sm">
                Stato: <Badge tone={domainStatus === "verified" ? "ok" : "warn"}>{domainStatus}</Badge>
              </p>
              <DnsRecords records={status.records} domain={w.emailDomain} />
              {domainStatus !== "verified" && (
                <div>
                  <ActionButton action={verifyEmailDomainAction.bind(null, id)} label="Verifica" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(w.emailMode === "shared_domain" || domainStatus === "verified") && (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <p>
            Crea una chiave Resend che può solo inviare, e solo da questo dominio, e scrive RESEND_API_KEY e MAIL_FROM su Vercel.
          </p>
          <div>
            <ActionButton action={finishEmailAction.bind(null, id)} label={retryLabel(states, "email", "Crea la chiave e salva")} variant="primary" />
          </div>
        </div>
      )}
    </div>
  );
}

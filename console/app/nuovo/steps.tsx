"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { Badge, Button, Field, Input, Notice, inputClass } from "@/components/ui";
import { SHORT_NAME_MAX } from "@/lib/brand/build";
import { paletteChecks, parseHex, pickOn } from "@/lib/brand/contrast";
import { slugify } from "@/lib/slug";
import type { DnsRecord } from "@/lib/providers/resend";
import {
  addDomainAction,
  checkPublishAction,
  chooseEmailModeAction,
  configureStripeAction,
  saveIdentityAction,
  saveRegistryAction,
  startPublishAction,
  type FormState,
} from "./actions";

const INITIAL: FormState = { error: null };

function FormError({ state }: { state: FormState }) {
  return state.error ? <Notice tone="danger">{state.error}</Notice> : null;
}

export function CopyButton({ text, label = "Copia" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copiato" : label}
    </Button>
  );
}

// --- 1. Anagrafica ----------------------------------------------------------------

export interface RegistryDefaults {
  name: string;
  slug: string;
  adminEmail: string;
  locale: "it" | "en";
  currency: string;
  timeZone: string;
  hostingModel: "managed" | "group_owned";
  vercelTeamId: string;
  vercelTeamSlug: string;
  neonOrgId: string;
  requestId: string | null;
}

export function RegistryStep({ instanceId, defaults, locked }: { instanceId: string | null; defaults: RegistryDefaults; locked: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRegistryAction.bind(null, instanceId), INITIAL);
  const [slug, setSlug] = useState(defaults.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaults.slug));
  const [model, setModel] = useState(defaults.hostingModel);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {locked && (
        <Notice tone="neutral" className="sm:col-span-2">
          Il database o l&apos;app esistono già: questi dati non si cambiano più da qui.
        </Notice>
      )}
      <input type="hidden" name="requestId" value={defaults.requestId ?? ""} />
      <Field label="Nome del gruppo" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={defaults.name}
          disabled={locked}
          onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
        />
      </Field>
      <Field label="Slug" htmlFor="slug" hint={`Progetti: wegrocery-${slug || "…"}`}>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          disabled={locked}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      </Field>
      <Field label="Email del primo admin" htmlFor="adminEmail" hint="Diventa BOOTSTRAP_ADMIN_EMAIL.">
        <Input id="adminEmail" name="adminEmail" type="email" required defaultValue={defaults.adminEmail} disabled={locked} />
      </Field>
      <Field label="Lingua" htmlFor="locale">
        <select id="locale" name="locale" className={inputClass} defaultValue={defaults.locale} disabled={locked}>
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </Field>
      <Field label="Valuta" htmlFor="currency">
        <Input id="currency" name="currency" maxLength={3} required defaultValue={defaults.currency} disabled={locked} />
      </Field>
      <Field label="Fuso orario" htmlFor="timeZone">
        <Input id="timeZone" name="timeZone" required defaultValue={defaults.timeZone} disabled={locked} />
      </Field>
      <Field label="Modello" htmlFor="hostingModel">
        <select
          id="hostingModel"
          name="hostingModel"
          className={inputClass}
          value={model}
          disabled={locked}
          onChange={(e) => setModel(e.target.value as "managed" | "group_owned")}
        >
          <option value="managed">Gestito (account dell&apos;operatore)</option>
          <option value="group_owned">Del gruppo (account del gruppo, operatore invitato)</option>
        </select>
      </Field>
      <div className="hidden sm:block" />
      <Field
        label={`Team ID Vercel${model === "group_owned" ? "" : " (facoltativo)"}`}
        htmlFor="vercelTeamId"
        hint={model === "group_owned" ? "Il team del gruppo in cui sei stato invitato." : "Vuoto = account personale del token."}
      >
        <Input id="vercelTeamId" name="vercelTeamId" placeholder="team_…" defaultValue={defaults.vercelTeamId} disabled={locked} />
      </Field>
      <Field label="Slug del team Vercel (per i link)" htmlFor="vercelTeamSlug">
        <Input id="vercelTeamSlug" name="vercelTeamSlug" defaultValue={defaults.vercelTeamSlug} disabled={locked} />
      </Field>
      <Field label={`Org ID Neon${model === "group_owned" ? "" : " (facoltativo)"}`} htmlFor="neonOrgId" hint="Necessario con una chiave API personale.">
        <Input id="neonOrgId" name="neonOrgId" placeholder="org-…" defaultValue={defaults.neonOrgId} disabled={locked} />
      </Field>
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      {!locked && (
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Salvataggio…" : "Salva e continua"}
          </Button>
        </div>
      )}
    </form>
  );
}

// --- 2. Identità iniziale -------------------------------------------------------------

export function IdentityStep({
  instanceId,
  defaults,
  locked,
}: {
  instanceId: string;
  defaults: { appName: string; shortName: string; primary: string; accent: string; logoUrl: string };
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveIdentityAction.bind(null, instanceId), INITIAL);
  const [appName, setAppName] = useState(defaults.appName);
  const [shortName, setShortName] = useState(defaults.shortName);
  const [primary, setPrimary] = useState(defaults.primary || "#237032");
  const [accent, setAccent] = useState(defaults.accent || "#1971c2");
  const valid = Boolean(parseHex(primary) && parseHex(accent));
  const checks = valid ? paletteChecks(primary, accent) : [];

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Field label="Nome dell'app" htmlFor="appName">
          <Input id="appName" name="appName" required maxLength={60} value={appName} onChange={(e) => setAppName(e.target.value)} disabled={locked} />
        </Field>
        <Field label="Nome breve" htmlFor="shortName" hint={`Sotto l'icona del telefono, max ${SHORT_NAME_MAX} caratteri.`}>
          <Input
            id="shortName"
            name="shortName"
            required
            maxLength={SHORT_NAME_MAX}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            disabled={locked}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["primary", "Colore principale", primary, setPrimary],
              ["accent", "Colore accento", accent, setAccent],
            ] as const
          ).map(([name, label, value, set]) => (
            <Field key={name} label={label} htmlFor={name}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label={`${label}: selettore`}
                  value={parseHex(value) ? value : "#000000"}
                  onChange={(e) => set(e.target.value)}
                  disabled={locked}
                  className="h-10 w-12 shrink-0 rounded border border-line bg-surface"
                />
                <Input id={name} name={name} value={value} onChange={(e) => set(e.target.value)} disabled={locked} />
              </div>
            </Field>
          ))}
        </div>
        <Field label="Logo (URL https, facoltativo)" htmlFor="logoUrl">
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={defaults.logoUrl} disabled={locked} />
        </Field>
        <p className="text-xs text-muted">
          Solo l&apos;identità iniziale: il gruppo la rifinisce poi nella configurazione guidata dell&apos;app.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Anteprima</p>
        <div className="rounded-xl border border-line p-4" style={{ background: "#faf8f5" }}>
          <p className="text-lg font-semibold" style={{ color: "#2d2b29" }}>
            {appName || "Nome dell'app"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {valid && (
              <>
                <span className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: primary, color: pickOn(primary) }}>
                  Conferma ordine
                </span>
                <span className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: accent, color: pickOn(accent) }}>
                  Ricarica
                </span>
              </>
            )}
          </div>
          <p className="mt-3 text-xs" style={{ color: "#58595b" }}>
            Icona: {shortName || "—"}
          </p>
        </div>
        {!valid && <Notice tone="warn">I colori devono essere esadecimali, es. #237032.</Notice>}
        {valid && (
          <ul className="flex flex-col gap-1 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-2">
                <span>{c.label}</span>
                <Badge tone={c.passes ? "ok" : "warn"}>
                  {c.ratio.toFixed(2)}:1 {c.passes ? "AA" : "sotto AA"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Sotto AA come testo su bianco non blocca: l&apos;app scurisce da sola il colore per i testi.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:col-span-2">
        <FormError state={state} />
        {!locked && (
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Salvataggio…" : "Salva e continua"}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

// --- 5. Email ----------------------------------------------------------------------

export function EmailModeForm({
  instanceId,
  mode,
  domain,
  sharedDomain,
}: {
  instanceId: string;
  mode: "group_domain" | "shared_domain" | null;
  domain: string;
  sharedDomain: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(chooseEmailModeAction.bind(null, instanceId), INITIAL);
  const [m, setM] = useState(mode ?? "group_domain");
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Da dove partono le email</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="emailMode" value="group_domain" checked={m === "group_domain"} onChange={() => setM("group_domain")} className="mt-1" />
          <span>Dominio del gruppo: creo il dominio su Resend e il gruppo aggiunge i record DNS.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="emailMode" value="shared_domain" checked={m === "shared_domain"} onChange={() => setM("shared_domain")} className="mt-1" />
          <span>
            Dominio condiviso{sharedDomain ? ` (${sharedDomain})` : " (non configurato)"}: subito pronto, mittente slug@dominio.
          </span>
        </label>
      </fieldset>
      {m === "group_domain" && (
        <Field label="Dominio del gruppo" htmlFor="emailDomain" hint="Meglio un sottodominio, es. mail.gasriva.it.">
          <Input id="emailDomain" name="emailDomain" defaultValue={domain} required />
        </Field>
      )}
      <Notice tone="warn">
        Resend Free consente 3 domini e 100 email al giorno per account: con più gruppi sullo stesso account il limite si
        divide.
      </Notice>
      <FormError state={state} />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvataggio…" : "Conferma"}
        </Button>
      </div>
    </form>
  );
}

export function DnsRecords({ records, domain }: { records: DnsRecord[]; domain: string }) {
  const asText = [
    `Record DNS da aggiungere per ${domain}:`,
    ...records.map((r) => `${r.type}\t${r.name}\t${r.value}${r.priority !== undefined ? `\t(priorità ${r.priority})` : ""}`),
  ].join("\n");
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-bg text-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">Tipo</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Nome</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Valore</th>
              <th scope="col" className="px-2 py-1.5 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {records.map((r, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5 font-mono">{r.type}{r.priority !== undefined ? ` ${r.priority}` : ""}</td>
                <td className="px-2 py-1.5 font-mono break-all">{r.name}</td>
                <td className="px-2 py-1.5 font-mono break-all">{r.value}</td>
                <td className="px-2 py-1.5">{r.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <CopyButton text={asText} label="Copia i record per il gruppo" />
      </div>
    </div>
  );
}

// --- 6. Pagamenti --------------------------------------------------------------------

export function StripeForm({ instanceId, webhookUrl }: { instanceId: string; webhookUrl: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(configureStripeAction.bind(null, instanceId), INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Chiave Stripe del gruppo"
        htmlFor="stripeKey"
        hint="sk_… o rk_… (limitata: Webhook Endpoints in scrittura, Checkout Sessions in scrittura, PaymentIntents e Refunds in lettura). Va subito su Vercel, la console non la conserva."
      >
        <Input id="stripeKey" name="stripeKey" type="password" autoComplete="off" required />
      </Field>
      <p className="text-sm text-muted">
        Endpoint del webhook: <span className="font-mono break-all">{webhookUrl}</span>
      </p>
      <Notice tone="neutral">Le chiavi live funzionano solo sul deploy di produzione; quelle di test ovunque.</Notice>
      <FormError state={state} />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Configurazione…" : "Crea webhook e salva su Vercel"}
        </Button>
      </div>
    </form>
  );
}

// --- 7. Pubblica ------------------------------------------------------------------------

export function PublishPanel({ instanceId, deploymentId, done }: { instanceId: string; deploymentId: string | null; done: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" | "danger" | "neutral" } | null>(null);
  const [polling, setPolling] = useState(Boolean(deploymentId) && !done);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    async function tick() {
      const r = await checkPublishAction(instanceId);
      if (cancelled) return;
      if (!r.ok) {
        setMessage({ text: r.error, tone: "danger" });
        setPolling(false);
        return;
      }
      const tone = r.phase === "ready" ? "ok" : r.phase === "failed" || r.phase === "migrations_pending" ? "danger" : "neutral";
      setMessage({ text: r.message, tone });
      if (tone !== "neutral") {
        setPolling(false);
        router.refresh();
        return;
      }
      timer.current = setTimeout(tick, 8000);
    }
    timer.current = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [polling, instanceId, router]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Avvia un deploy di produzione di main. La build applica le migrazioni al database vuoto (MIGRATE_ON_BUILD); poi la
        console aspetta che /api/health risponda e che le statistiche firmate non mostrino migrazioni in sospeso.
      </p>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={pending || polling}
          onClick={() =>
            startTransition(async () => {
              const r = await startPublishAction(instanceId);
              if (!r.ok) return setMessage({ text: r.error, tone: "danger" });
              setMessage({ text: "Deploy avviato…", tone: "neutral" });
              setPolling(true);
            })
          }
        >
          {polling ? "In attesa…" : deploymentId ? "Nuovo deploy" : "Avvia deploy"}
        </Button>
        {deploymentId && !polling && !done && (
          <Button onClick={() => setPolling(true)}>Controlla di nuovo</Button>
        )}
      </div>
    </div>
  );
}

// --- 8. Dominio --------------------------------------------------------------------------

export function DomainForm({ instanceId }: { instanceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addDomainAction.bind(null, instanceId), INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Dominio personalizzato" htmlFor="domain" hint="Es. gas.riva.it. Aggiorna anche APP_BASE_URL.">
        <Input id="domain" name="domain" required />
      </Field>
      <FormError state={state} />
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Aggiunta…" : "Aggiungi a Vercel"}
        </Button>
      </div>
    </form>
  );
}

export { ActionButton };

"use client";

import { useActionState, type ReactNode } from "react";
import { submitIntake, type IntakeState } from "@/app/actions/requests";
import { Button, Field, Input, Notice, inputClass } from "@/components/ui";
import { HONEYPOT_FIELD, LIMITS } from "@/lib/intake";

function Check({ name, label, defaultChecked, required }: { name: string; label: ReactNode; defaultChecked?: boolean; required?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} required={required} className="mt-0.5 size-4 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}

export function IntakeForm() {
  const [state, action, pending] = useActionState<IntakeState, FormData>(submitIntake, { errors: {}, formError: null, values: {} });
  const v = state.values;
  const e = state.errors;
  const on = (k: string) => v[k] === "on";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Notice tone="warn" className="sm:col-span-2">
        Non inserire password, chiavi o token: non servono in questa fase e ti chiederemo noi, in modo sicuro, quello che serve.
      </Notice>

      {/* Honeypot: hidden from people and assistive tech, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Sito web</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Nome del gruppo" htmlFor="groupName" error={e.groupName}>
        <Input id="groupName" name="groupName" required maxLength={LIMITS.groupName} defaultValue={v.groupName} />
      </Field>
      <Field label="Città" htmlFor="city" error={e.city}>
        <Input id="city" name="city" maxLength={LIMITS.city} defaultValue={v.city} />
      </Field>
      <Field label="Nome del referente" htmlFor="contactName" error={e.contactName}>
        <Input id="contactName" name="contactName" required maxLength={LIMITS.contactName} autoComplete="name" defaultValue={v.contactName} />
      </Field>
      <Field label="Email del referente" htmlFor="contactEmail" error={e.contactEmail}>
        <Input id="contactEmail" name="contactEmail" type="email" required maxLength={LIMITS.contactEmail} autoComplete="email" defaultValue={v.contactEmail} />
      </Field>
      <Field label="Numero indicativo di soci" htmlFor="membersEstimate" error={e.membersEstimate}>
        <Input id="membersEstimate" name="membersEstimate" type="number" min={1} max={100000} inputMode="numeric" defaultValue={v.membersEstimate} />
      </Field>
      <Field label="Lingua dell'app" htmlFor="locale" error={e.locale}>
        <select id="locale" name="locale" className={inputClass} defaultValue={v.locale ?? "it"}>
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </Field>
      <Field label="Valuta" htmlFor="currency" error={e.currency} hint="Codice ISO, es. EUR.">
        <Input id="currency" name="currency" maxLength={3} defaultValue={v.currency ?? "EUR"} />
      </Field>
      <Field label="Fuso orario" htmlFor="timeZone" error={e.timeZone}>
        <Input id="timeZone" name="timeZone" defaultValue={v.timeZone ?? "Europe/Rome"} />
      </Field>
      <Field label="Dominio email del gruppo (se ce l'avete)" htmlFor="emailDomain" error={e.emailDomain} hint="Es. gasriva.it: le email partirebbero da lì.">
        <Input id="emailDomain" name="emailDomain" maxLength={LIMITS.emailDomain} defaultValue={v.emailDomain} />
      </Field>
      <Field label="Chi gestisce i DNS del dominio" htmlFor="dnsManager" error={e.dnsManager} hint="Es. Aruba, un socio, un fornitore.">
        <Input id="dnsManager" name="dnsManager" maxLength={LIMITS.dnsManager} defaultValue={v.dnsManager} />
      </Field>
      <Field label="Logo (URL, facoltativo)" htmlFor="logoUrl" error={e.logoUrl}>
        <Input id="logoUrl" name="logoUrl" type="url" maxLength={LIMITS.logoUrl} placeholder="https://" defaultValue={v.logoUrl} />
      </Field>
      <Field label="Colori (facoltativo)" htmlFor="colors" error={e.colors} hint="Es. verde #237032 e blu.">
        <Input id="colors" name="colors" maxLength={LIMITS.colors} defaultValue={v.colors} />
      </Field>
      <Field label="Modalità di pagamento" htmlFor="paymentMode">
        <select id="paymentMode" name="paymentMode" className={inputClass} defaultValue={v.paymentMode ?? "wallet"}>
          <option value="wallet">Borsellino (saldo ricaricabile)</option>
          <option value="per_order">Pagamento a ogni ordine</option>
        </select>
      </Field>
      <Field label="Modello preferito" htmlFor="hostingPreference">
        <select id="hostingPreference" name="hostingPreference" className={inputClass} defaultValue={v.hostingPreference ?? "managed"}>
          <option value="managed">Gestito da Federico</option>
          <option value="group_owned">Sugli account del gruppo</option>
        </select>
      </Field>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Funzioni</legend>
        <Check name="onlinePayments" label="Pagamenti online con carta (serve un account Stripe del gruppo)" defaultChecked={on("onlinePayments")} />
        <Check name="googleLogin" label="Accesso con Google, oltre al link via email" defaultChecked={on("googleLogin")} />
        <Check name="cardCheck" label="Controllo della tessera associativa all'accesso" defaultChecked={on("cardCheck")} />
      </fieldset>

      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="notes" error={e.notes}>
          <textarea id="notes" name="notes" rows={4} maxLength={LIMITS.notes} defaultValue={v.notes} className={inputClass} />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Check
          name="privacy"
          required
          defaultChecked={on("privacy")}
          label="Acconsento al trattamento dei dati di questo modulo per essere ricontattato sulla richiesta. I dati non vengono ceduti a terzi."
        />
        {e.privacy && <p className="mt-1 text-xs text-danger">{e.privacy}</p>}
      </div>

      {state.formError && <Notice tone="danger" className="sm:col-span-2">{state.formError}</Notice>}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Invio…" : "Invia la richiesta"}
        </Button>
      </div>
    </form>
  );
}

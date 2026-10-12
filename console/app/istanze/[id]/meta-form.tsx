"use client";

import { useActionState } from "react";
import { updateInstanceMeta, type MetaState } from "@/app/actions/instances";
import { Button, Field, Input, Notice, inputClass } from "@/components/ui";

export function MetaForm({
  instanceId,
  url,
  notes,
  rolloutOrder,
  vercelTeamSlug,
}: {
  instanceId: string;
  url: string;
  notes: string | null;
  rolloutOrder: number;
  vercelTeamSlug: string | null;
}) {
  const [state, action, pending] = useActionState<MetaState, FormData>(updateInstanceMeta.bind(null, instanceId), { error: null });
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="URL" htmlFor="url">
        <Input id="url" name="url" type="url" required defaultValue={url} />
      </Field>
      <Field label="Ordine di rilascio" htmlFor="rolloutOrder" hint="Più alto = aggiornata più tardi.">
        <Input id="rolloutOrder" name="rolloutOrder" type="number" min={0} max={10000} defaultValue={rolloutOrder} />
      </Field>
      <Field label="Team Vercel (slug, per i link)" htmlFor="vercelTeamSlug">
        <Input id="vercelTeamSlug" name="vercelTeamSlug" defaultValue={vercelTeamSlug ?? ""} />
      </Field>
      <Field label="Nuovo segreto statistiche" htmlFor="statsSecret" hint="Solo per sostituirlo; vuoto lo lascia com'è.">
        <Input id="statsSecret" name="statsSecret" type="password" autoComplete="off" minLength={32} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="notes" hint="Niente password o chiavi.">
          <textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={notes ?? ""} className={inputClass} />
        </Field>
      </div>
      {state.error && <Notice tone="danger" className="sm:col-span-2">{state.error}</Notice>}
      {state.saved && !state.error && <Notice tone="ok" className="sm:col-span-2">Salvato.</Notice>}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </form>
  );
}

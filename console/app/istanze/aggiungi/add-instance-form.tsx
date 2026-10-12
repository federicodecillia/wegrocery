"use client";

import { useActionState, useState } from "react";
import { addExistingInstance, type AddInstanceState } from "@/app/actions/instances";
import { Button, Field, Input, Notice, inputClass } from "@/components/ui";
import { slugify } from "@/lib/slug";

export function AddInstanceForm() {
  const [state, action, pending] = useActionState<AddInstanceState, FormData>(addExistingInstance, { error: null });
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome" htmlFor="name">
        <Input id="name" name="name" required maxLength={80} onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))} />
      </Field>
      <Field label="Slug" htmlFor="slug" hint="Minuscole, cifre e trattini.">
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </Field>
      <Field label="URL" htmlFor="url" hint="L'indirizzo dell'app, es. https://gas.portamoneta.org">
        <Input id="url" name="url" type="url" required placeholder="https://" />
      </Field>
      <Field label="Modello" htmlFor="hostingModel">
        <select id="hostingModel" name="hostingModel" className={inputClass} defaultValue="managed">
          <option value="managed">Gestito (account dell&apos;operatore)</option>
          <option value="group_owned">Del gruppo (account del gruppo)</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Segreto delle statistiche (INSTANCE_STATS_SECRET)"
          htmlFor="statsSecret"
          hint="Lo stesso valore impostato sull'istanza (almeno 32 caratteri, es. openssl rand -hex 32). Viene salvato cifrato e non si rilegge più."
        >
          <Input id="statsSecret" name="statsSecret" type="password" autoComplete="off" minLength={32} />
        </Field>
      </div>
      <Field label="Ordine di rilascio" htmlFor="rolloutOrder" hint="Più alto = aggiornata più tardi (es. 1000 per la produzione con soci veri).">
        <Input id="rolloutOrder" name="rolloutOrder" type="number" min={0} max={10000} defaultValue={100} />
      </Field>
      <Field label="Team Vercel (slug, per i link)" htmlFor="vercelTeamSlug">
        <Input id="vercelTeamSlug" name="vercelTeamSlug" />
      </Field>
      <Field label="Team ID Vercel (facoltativo)" htmlFor="vercelTeamId">
        <Input id="vercelTeamId" name="vercelTeamId" placeholder="team_…" />
      </Field>
      <Field label="Project ID Vercel (per ridistribuire)" htmlFor="vercelProjectId">
        <Input id="vercelProjectId" name="vercelProjectId" placeholder="prj_…" />
      </Field>
      <Field label="Org ID Neon (facoltativo)" htmlFor="neonOrgId">
        <Input id="neonOrgId" name="neonOrgId" placeholder="org-…" />
      </Field>
      <Field label="Project ID Neon (facoltativo)" htmlFor="neonProjectId">
        <Input id="neonProjectId" name="neonProjectId" />
      </Field>
      {state.error && (
        <Notice tone="danger" className="sm:col-span-2">
          {state.error}
        </Notice>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Salvataggio…" : "Aggiungi"}
        </Button>
      </div>
    </form>
  );
}

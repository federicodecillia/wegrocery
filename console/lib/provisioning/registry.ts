import { isValidTimeZone } from "@/lib/brand/build";
import { EMAIL_PATTERN } from "@/lib/intake";
import { validateSlug } from "@/lib/slug";

// Step 1 of the wizard (Anagrafica): validation, pure.

export interface RegistryInput {
  name: string;
  slug: string;
  adminEmail: string;
  locale: "it" | "en";
  currency: string;
  timeZone: string;
  hostingModel: "managed" | "group_owned";
  vercelTeamId: string | null;
  vercelTeamSlug: string | null;
  neonOrgId: string | null;
  requestId: string | null;
}

export function registryErrors(i: RegistryInput): string[] {
  const errors: string[] = [];
  if (!i.name.trim() || i.name.length > 80) errors.push("Il nome del gruppo è obbligatorio (max 80 caratteri).");
  const slugError = validateSlug(i.slug);
  if (slugError) errors.push(slugError);
  if (!EMAIL_PATTERN.test(i.adminEmail)) errors.push("Email del primo admin non valida.");
  if (!/^[A-Z]{3}$/.test(i.currency)) errors.push("Valuta: codice ISO di 3 lettere.");
  if (!isValidTimeZone(i.timeZone)) errors.push("Fuso orario non valido.");
  if (i.hostingModel === "group_owned" && (!i.vercelTeamId || !i.neonOrgId)) {
    errors.push("Per un'installazione del gruppo servono il Team ID Vercel e l'Org ID Neon del gruppo.");
  }
  for (const [label, v] of [["Team ID Vercel", i.vercelTeamId], ["Org ID Neon", i.neonOrgId]] as const) {
    if (v && !/^[A-Za-z0-9_-]{3,64}$/.test(v)) errors.push(`${label} non valido.`);
  }
  return errors;
}

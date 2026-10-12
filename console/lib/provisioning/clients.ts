import type { Instance } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { ProviderError } from "@/lib/http";
import { neonClient } from "@/lib/providers/neon";
import { resendClient } from "@/lib/providers/resend";
import { vercelClient } from "@/lib/providers/vercel";

// Provider clients for one instance: the operator's personal tokens, scoped
// to the instance's Vercel team (managed: the operator's own team or
// account; group-owned: the group's team the operator was invited to).

function need(value: string | null, name: string): string {
  if (!value) throw new ProviderError("Console", 0, `${name} non è impostata`);
  return value;
}

export function vercelFor(instance: Pick<Instance, "vercelTeamId">) {
  return vercelClient({ token: need(env.vercelToken(), "VERCEL_TOKEN"), teamId: instance.vercelTeamId });
}

export function neonFor() {
  return neonClient({ apiKey: need(env.neonApiKey(), "NEON_API_KEY") });
}

export function resendForProvisioning() {
  return resendClient({ apiKey: need(env.resendApiKey(), "RESEND_API_KEY") });
}

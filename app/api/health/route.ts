import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { checkHealth } from "@/lib/health";
import packageJson from "@/package.json";

// Liveness for uptime monitors, the post-deploy smoke test and the FlyLabs
// Console (Playbook 7.1, FlyLabs Kit module `console`): { ok, version, db },
// 200 or 503, no-store. Public (excluded from the auth proxy): it says only
// whether the app answers and reaches its database within 3 seconds, never
// any data, configuration or error text. A failure is not logged: the
// endpoint is public, and a probe must not be able to fill the log.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const health = await checkHealth(() => getDb().execute(sql`SELECT 1`), packageJson.version);
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

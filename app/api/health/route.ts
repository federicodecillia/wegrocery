import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import packageJson from "@/package.json";

// Liveness for uptime monitors and for the post-deploy smoke test. Public
// (excluded from the auth proxy): it says only whether the app answers
// and reaches its database, never any data or configuration.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let db = false;
  try {
    await getDb().execute(sql`SELECT 1`);
    db = true;
  } catch {
    // Reported as db: false. Not logged: the endpoint is public, and a probe
    // must not be able to fill the log.
  }
  return Response.json(
    { ok: db, version: packageJson.version, db },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

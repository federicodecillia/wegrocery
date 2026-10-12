import { alertEmailText, instanceAlerts } from "@/lib/alerts";
import { safeEqual } from "@/lib/auth/session-token";
import { audit } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { refreshAll } from "@/lib/fleet/refresh";
import { mailOperator } from "@/lib/mail";
import { reportError } from "@/lib/report-error";

// Daily Vercel Cron (console/vercel.json): refresh every instance and email
// the operator about the ones that need attention. Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`; without CRON_SECRET the route is closed.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const secret = env.cronSecret();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Not found", { status: 404 });

  try {
    const results = await refreshAll();
    const flagged = results
      .map(({ instance, result }) => ({
        name: instance.name,
        url: instance.url,
        alerts: instanceAlerts({ name: instance.name, url: instance.url, ...result }),
      }))
      .filter((r) => r.alerts.length);
    let mailed = false;
    if (flagged.length) {
      const consoleUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;
      mailed = await mailOperator(
        `WeGrocery: ${flagged.length} istanz${flagged.length === 1 ? "a" : "e"} da controllare`,
        alertEmailText(flagged, consoleUrl),
      );
    }
    await audit("cron_refresh", null, `${results.length} istanze, ${flagged.length} con avvisi${mailed ? ", email inviata" : ""}`);
    return Response.json({ ok: true, instances: results.length, flagged: flagged.length, mailed });
  } catch (e) {
    reportError("cron_refresh", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

import { collectInstanceStats } from "@/lib/instance-stats/collect";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyRequest } from "@/lib/instance-stats/signature";
import { reportError } from "@/lib/observability";

// Anonymous counts for a fleet console (lib/instance-stats). Closed unless the
// deploy sets INSTANCE_STATS_SECRET and the request carries a fresh signature
// made with it; any refusal is a plain 404, as if the route did not exist.
// Excluded from the auth proxy: the console has no member session.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/instance-stats";

export async function GET(request: Request): Promise<Response> {
  const now = new Date();
  const ok = verifyRequest({
    secret: process.env.INSTANCE_STATS_SECRET,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    method: "GET",
    path: PATH,
    nowSeconds: Math.floor(now.getTime() / 1000),
  });
  if (!ok) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const stats = await collectInstanceStats(now);
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    reportError("instance-stats", e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

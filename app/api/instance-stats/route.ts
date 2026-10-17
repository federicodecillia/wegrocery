import { collectInstanceStats } from "@/lib/instance-stats/collect";
import { toFlyLabsStats } from "@/lib/instance-stats/envelope";
import { verifiedContract } from "@/lib/instance-stats/signature";
import { reportError } from "@/lib/observability";

// Anonymous counts for a fleet console (lib/instance-stats, FlyLabs Kit module
// `console`). Closed unless the deploy sets INSTANCE_STATS_SECRET and the
// request carries a fresh signature made with it; any refusal is a plain 404,
// as if the route did not exist. Signed with x-flylabs-* it answers the kit's
// envelope, with x-wegrocery-* the shape the WeGrocery Console read before.
// Excluded from the auth proxy: the console has no member session.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/instance-stats";

export async function GET(request: Request): Promise<Response> {
  const now = new Date();
  const contract = verifiedContract(request.headers, {
    secret: process.env.INSTANCE_STATS_SECRET,
    method: "GET",
    path: PATH,
    nowSeconds: Math.floor(now.getTime() / 1000),
  });
  if (!contract) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const stats = await collectInstanceStats(now);
    return Response.json(contract === "flylabs" ? toFlyLabsStats(stats) : stats, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    reportError("instance-stats", e);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

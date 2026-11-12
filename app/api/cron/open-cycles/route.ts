import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { cronAuthorized } from "@/lib/cycles/cron-auth";
import { openDuePlannedCycles } from "@/lib/cycles/open-planned";

// Once a day, early in the morning (vercel.json, Vercel Cron, Hobby too):
// opens the planned cycles whose day has come (lib/cycles/open-planned.ts).
// Closed (404) without CRON_SECRET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const opened = await openDuePlannedCycles(getDb(), new Date());
    // One line per run, so the Vercel runtime logs show that it ran and what it did.
    console.info(`[auto_open] ok, opened ${opened.length}${opened.length > 0 ? `: ${opened.join(", ")}` : ""}`);
    if (opened.length > 0) {
      revalidatePath("/admin");
      revalidatePath("/");
      revalidatePath("/ordine");
      revalidatePath("/calendario");
      revalidatePath("/notifiche");
      revalidatePath("/gruppo");
    }
    return Response.json({ ok: true, opened: opened.length });
  } catch (e) {
    console.error("[auto_open] failed:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}

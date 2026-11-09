import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { cronAuthorized, openingDue } from "@/lib/cycles/cron-auth";
import { invalidatePlannedOpenings, nextPlannedOpening, openDuePlannedCycles } from "@/lib/cycles/open-planned";

// Every minute (vercel.json, Vercel Cron, Pro plan): opens the planned cycles
// whose time has come (lib/cycles/open-planned.ts). Most minutes it answers
// from the cached time of the next opening and never touches the database,
// which can then sleep. Closed (404) without CRON_SECRET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Not found", { status: 404 });
  }
  const now = new Date();
  if (!openingDue(await nextPlannedOpening(), now)) return Response.json({ ok: true, opened: 0 });
  try {
    const opened = await openDuePlannedCycles(getDb(), now);
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
  } finally {
    // Read the next opening again, whatever happened.
    invalidatePlannedOpenings();
  }
}

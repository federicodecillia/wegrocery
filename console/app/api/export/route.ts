import { hasOperatorSession } from "@/lib/auth/session";
import { audit, listInstancesWithLatest } from "@/lib/db/queries";
import { latestRelease } from "@/lib/fleet/refresh";
import { fleetCsv, fleetNewest, fleetRows } from "@/lib/fleet/table";

// "Esporta CSV": the fleet table, same columns. Operator only.

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await hasOperatorSession())) return new Response("Not found", { status: 404 });
  const sources = await listInstancesWithLatest(false);
  const csv = fleetCsv(fleetRows(sources, fleetNewest(sources, await latestRelease())));
  await audit("export_csv", null, `${sources.length} righe`);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wegrocery-istanze-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

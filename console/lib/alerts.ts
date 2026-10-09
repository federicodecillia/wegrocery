import type { HealthResponse, InstanceStats } from "@/lib/stats/types";

// What the daily refresh emails the operator about, pure.

export interface AlertInput {
  name: string;
  url: string;
  health: HealthResponse | null;
  stats: InstanceStats | null;
  error: string | null;
}

export function instanceAlerts(i: AlertInput): string[] {
  const out: string[] = [];
  if (!i.health) out.push("non risponde a /api/health");
  else if (!i.health.ok) out.push(`non in salute (database ${i.health.db ? "ok" : "non raggiungibile"})`);
  if (i.stats?.pendingMigrations.length) out.push(`migrazioni in sospeso: ${i.stats.pendingMigrations.join(", ")}`);
  const missing = i.stats?.config.filter((c) => c.status === "missing").map((c) => c.id) ?? [];
  if (missing.length) out.push(`configurazione mancante: ${missing.join(", ")}`);
  return out;
}

export function alertEmailText(rows: { name: string; url: string; alerts: string[] }[], consoleUrl: string | null): string {
  const lines = ["Controllo giornaliero della flotta WeGrocery: queste istanze hanno bisogno di attenzione.", ""];
  for (const r of rows) {
    lines.push(`${r.name} (${r.url})`);
    for (const a of r.alerts) lines.push(`  - ${a}`);
    lines.push("");
  }
  if (consoleUrl) lines.push(`Console: ${consoleUrl}`);
  return lines.join("\n");
}

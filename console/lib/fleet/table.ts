import { toCsv } from "@/lib/csv";
import { configCounts, type InstanceStats } from "@/lib/stats/types";
import { isBehind, newestVersion } from "@/lib/version";

// The fleet table (/ and its CSV export) from the registry rows, pure.

export interface FleetSource {
  instance: {
    id: string;
    name: string;
    slug: string;
    url: string;
    hostingModel: "managed" | "group_owned";
    status: "provisioning" | "live" | "archived";
    createdAt: Date;
  };
  latest: {
    takenAt: Date;
    healthOk: boolean | null;
    healthVersion: string | null;
    stats: InstanceStats | null;
    error: string | null;
  } | null;
}

export type Health = "ok" | "down" | "unknown";

export interface FleetRow {
  id: string;
  name: string;
  slug: string;
  url: string;
  model: string;
  status: FleetSource["instance"]["status"];
  createdAt: Date;
  version: string | null;
  behind: boolean;
  health: Health;
  activeMembers: number | null;
  admins: number | null;
  cycles: number | null;
  orders30: number | null;
  databaseBytes: number | null;
  configMissing: number;
  configWarning: number;
  pendingMigrations: number;
  refreshedAt: Date | null;
  error: string | null;
}

export const MODEL_LABEL = { managed: "Gestito", group_owned: "Del gruppo" } as const;
export const HEALTH_LABEL: Record<Health, string> = { ok: "OK", down: "Non risponde", unknown: "—" };

export function fleetNewest(sources: FleetSource[], githubRelease: string | null): string | null {
  return newestVersion([githubRelease, ...sources.map((s) => s.latest?.stats?.version ?? s.latest?.healthVersion)]);
}

export function fleetRows(sources: FleetSource[], newest: string | null): FleetRow[] {
  return sources.map(({ instance: i, latest: l }) => {
    const stats = l?.stats ?? null;
    const version = stats?.version ?? l?.healthVersion ?? null;
    const counts = configCounts(stats);
    return {
      id: i.id,
      name: i.name,
      slug: i.slug,
      url: i.url,
      model: MODEL_LABEL[i.hostingModel],
      status: i.status,
      createdAt: i.createdAt,
      version,
      behind: isBehind(version, newest),
      health: !l ? "unknown" : l.healthOk ? "ok" : "down",
      activeMembers: stats?.members.active ?? null,
      admins: stats?.members.admins ?? null,
      cycles: stats?.cycles.total ?? null,
      orders30: stats?.ordersLast30Days ?? null,
      databaseBytes: stats?.databaseBytes ?? null,
      configMissing: counts.missing,
      configWarning: counts.warning,
      pendingMigrations: stats?.pendingMigrations.length ?? 0,
      refreshedAt: l?.takenAt ?? null,
      error: l?.error ?? null,
    };
  });
}

export function fleetTotals(rows: FleetRow[]) {
  return {
    instances: rows.length,
    activeMembers: rows.reduce((s, r) => s + (r.activeMembers ?? 0), 0),
    orders30: rows.reduce((s, r) => s + (r.orders30 ?? 0), 0),
  };
}

export function matchesSearch(row: FleetRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.slug, row.url, row.model].some((v) => v.toLowerCase().includes(needle));
}

export const CSV_HEADER = [
  "nome",
  "url",
  "modello",
  "creata_il",
  "versione",
  "indietro",
  "salute",
  "soci_attivi",
  "admin",
  "cicli",
  "ordini_30gg",
  "spazio_db_byte",
  "config_mancanti",
  "config_avvisi",
  "ultimo_aggiornamento",
];

export function fleetCsv(rows: FleetRow[]): string {
  return toCsv(
    CSV_HEADER,
    rows.map((r) => [
      r.name,
      r.url,
      r.model,
      r.createdAt.toISOString().slice(0, 10),
      r.version,
      r.behind ? "si" : "no",
      HEALTH_LABEL[r.health],
      r.activeMembers,
      r.admins,
      r.cycles,
      r.orders30,
      r.databaseBytes,
      r.configMissing,
      r.configWarning,
      r.refreshedAt?.toISOString() ?? null,
    ]),
  );
}

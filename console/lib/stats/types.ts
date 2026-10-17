// What an instance answers, as the Console keeps it (snapshots store this
// shape). Kept in step with the main app's GET /api/instance-stats (the
// FlyLabs Kit envelope, lib/instance-stats/envelope.ts there, or its older
// shape) and GET /api/health.

export type ConfigItemStatus = "ok" | "missing" | "warning" | "off";

export interface InstanceStats {
  version: string;
  generatedAt: string;
  installedAt: string | null;
  members: { active: number; admins: number; total: number };
  cycles: { total: number; open: number; lastClosedAt: string | null };
  ordersLast30Days: number;
  databaseBytes: number | null;
  paymentMode: string;
  config: { id: string; status: ConfigItemStatus }[];
  pendingMigrations: string[];
  setupCompleted: boolean;
}

export interface HealthResponse {
  ok: boolean;
  version: string | null;
  db: boolean;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const CONFIG_STATUSES = new Set(["ok", "missing", "warning", "off"]);

/** Validates an untrusted stats body; null when the shape does not match.
 * Reads the FlyLabs Kit envelope (`app`, `counts`, ...) that instances answer
 * since the kit, and the older WeGrocery shape (members, cycles at the top)
 * of instances from before it; both become the same InstanceStats, which is
 * also what older snapshots stored. */
export function parseStats(body: unknown): InstanceStats | null {
  if (!isObj(body)) return null;
  return isObj(body.counts) ? parseKitStats(body) : parseLegacyStats(body);
}

// The fields both shapes share.
function parseCommon(body: Record<string, unknown>) {
  const { config, pendingMigrations } = body;
  if (typeof body.version !== "string" || typeof body.generatedAt !== "string") return null;
  if (!isStrOrNull(body.installedAt)) return null;
  if (!(body.databaseBytes === null || isNum(body.databaseBytes))) return null;
  if (typeof body.paymentMode !== "string") return null;
  if (!Array.isArray(config)) return null;
  for (const c of config) {
    if (!isObj(c) || typeof c.id !== "string" || !CONFIG_STATUSES.has(c.status as string)) return null;
  }
  if (!Array.isArray(pendingMigrations) || !pendingMigrations.every((m) => typeof m === "string")) return null;
  if (typeof body.setupCompleted !== "boolean") return null;
  return {
    version: body.version,
    generatedAt: body.generatedAt,
    installedAt: body.installedAt,
    databaseBytes: body.databaseBytes,
    paymentMode: body.paymentMode,
    config: (config as { id: string; status: ConfigItemStatus }[]).map((c) => ({ id: c.id, status: c.status })),
    pendingMigrations: pendingMigrations as string[],
    setupCompleted: body.setupCompleted,
  };
}

// The kit's envelope: WeGrocery's numbers in counts, by name; when the last
// cycle closed, the payment mode and the setup state are fields of its own.
function parseKitStats(body: Record<string, unknown>): InstanceStats | null {
  if (body.app !== "wegrocery") return null;
  const counts = body.counts as Record<string, unknown>;
  const common = parseCommon(body);
  if (!common || !isStrOrNull(body.lastClosedAt)) return null;
  const { activeMembers, admins, members, cycles, openCycles, ordersLast30Days } = counts;
  if (![activeMembers, admins, members, cycles, openCycles, ordersLast30Days].every(isNum)) return null;
  const { version, generatedAt, installedAt, ...rest } = common;
  return {
    version,
    generatedAt,
    installedAt,
    members: { active: activeMembers as number, admins: admins as number, total: members as number },
    cycles: { total: cycles as number, open: openCycles as number, lastClosedAt: body.lastClosedAt },
    ordersLast30Days: ordersLast30Days as number,
    ...rest,
  };
}

function parseLegacyStats(body: Record<string, unknown>): InstanceStats | null {
  const { members, cycles } = body;
  const common = parseCommon(body);
  if (!common) return null;
  if (!isObj(members) || !isNum(members.active) || !isNum(members.admins) || !isNum(members.total)) return null;
  if (!isObj(cycles) || !isNum(cycles.total) || !isNum(cycles.open) || !isStrOrNull(cycles.lastClosedAt)) return null;
  if (!isNum(body.ordersLast30Days)) return null;
  const { version, generatedAt, installedAt, ...rest } = common;
  return {
    version,
    generatedAt,
    installedAt,
    members: { active: members.active, admins: members.admins, total: members.total },
    cycles: { total: cycles.total, open: cycles.open, lastClosedAt: cycles.lastClosedAt },
    ordersLast30Days: body.ordersLast30Days,
    ...rest,
  };
}

export function parseHealth(body: unknown): HealthResponse | null {
  if (!isObj(body) || typeof body.ok !== "boolean") return null;
  return {
    ok: body.ok,
    version: typeof body.version === "string" ? body.version : null,
    db: body.db === true,
  };
}

/** Missing and warning items of the configuration status. */
export function configCounts(stats: Pick<InstanceStats, "config"> | null): { missing: number; warning: number } {
  const out = { missing: 0, warning: 0 };
  for (const c of stats?.config ?? []) {
    if (c.status === "missing") out.missing++;
    if (c.status === "warning") out.warning++;
  }
  return out;
}

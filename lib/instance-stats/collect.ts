import { sql } from "drizzle-orm";
import { getConfigStatus } from "@/lib/config-status-server";
import { getDb } from "@/lib/db/client";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import packageJson from "@/package.json";

// What /api/instance-stats tells a fleet console about this installation:
// counts and states only. No name, address, amount or balance of anyone, no
// variable value: the same rule as the configuration status card.
export type InstanceStats = {
  version: string;
  generatedAt: string;
  // The first migration applied to this database: when the installation was set up.
  installedAt: string | null;
  members: { active: number; admins: number; total: number };
  cycles: { total: number; open: number; lastClosedAt: string | null };
  // Member orders on cycles that closed in the last 30 days.
  ordersLast30Days: number;
  databaseBytes: number | null;
  paymentMode: string;
  // Configuration status, item by item: { id, status }, plus pending migrations.
  config: { id: string; status: string }[];
  pendingMigrations: string[];
  setupCompleted: boolean;
};

const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

export async function collectInstanceStats(now: Date): Promise<InstanceStats> {
  const db = getDb();
  const [counts, config, payments] = await Promise.all([
    db.execute<{
      installed_at: string | null;
      active: number;
      admins: number;
      total: number;
      cycles: number;
      open_cycles: number;
      last_closed_at: string | null;
      orders_30d: number;
      db_bytes: string | null;
      setup_completed: boolean;
    }>(sql`
      SELECT
        (SELECT min(applied_at) FROM _migrations) AS installed_at,
        (SELECT count(*)::int FROM members WHERE active AND merged_into IS NULL) AS active,
        (SELECT count(*)::int FROM members WHERE active AND role = 'admin') AS admins,
        (SELECT count(*)::int FROM members WHERE merged_into IS NULL) AS total,
        (SELECT count(*)::int FROM order_cycles) AS cycles,
        (SELECT count(*)::int FROM order_cycles WHERE status = 'open') AS open_cycles,
        (SELECT max(closed_at) FROM order_cycles WHERE status = 'closed') AS last_closed_at,
        (SELECT count(DISTINCT (o.member_id, o.cycle_id))::int
           FROM orders o JOIN order_cycles c ON c.cycle_id = o.cycle_id
          WHERE c.status = 'closed' AND c.closed_at >= ${now.toISOString()}::timestamptz - interval '30 days') AS orders_30d,
        pg_database_size(current_database())::text AS db_bytes,
        coalesce((SELECT setup_completed_at IS NOT NULL FROM group_identity WHERE id = 1), false) AS setup_completed
    `),
    getConfigStatus(),
    getPaymentSettings(),
  ]);
  const row = counts.rows[0];
  const database = config.find((c) => c.id === "database");
  return {
    version: packageJson.version,
    generatedAt: now.toISOString(),
    installedAt: iso(row.installed_at),
    members: { active: row.active, admins: row.admins, total: row.total },
    cycles: { total: row.cycles, open: row.open_cycles, lastClosedAt: iso(row.last_closed_at) },
    ordersLast30Days: row.orders_30d,
    databaseBytes: row.db_bytes == null ? null : Number(row.db_bytes),
    paymentMode: payments.mode,
    config: config.map((c) => ({ id: c.id, status: c.status })),
    pendingMigrations: database?.note === "pendingMigrations" ? [...(database.detail ?? [])] : [],
    setupCompleted: row.setup_completed,
  };
}

import type { WeGroceryInstanceStats } from "./collect";
import type { InstanceStats } from "./stats";

// The FlyLabs Kit envelope (module `console`, Playbook 7.10) for WeGrocery's
// numbers: the shared fields as they are, the counts by name in camelCase,
// plus three fields of WeGrocery's own that are not counts (the kit lets an
// app add fields; the Console reads the ones it knows). Pure.
export type WeGroceryFlyLabsStats = InstanceStats & {
  // When the last cycle closed, the payment mode and whether the first-run
  // setup is done: states, never amounts.
  lastClosedAt: string | null;
  paymentMode: string;
  setupCompleted: boolean;
};

export const APP_ID = "wegrocery";

export function toFlyLabsStats(s: WeGroceryInstanceStats): WeGroceryFlyLabsStats {
  return {
    app: APP_ID,
    version: s.version,
    generatedAt: s.generatedAt,
    installedAt: s.installedAt,
    databaseBytes: s.databaseBytes,
    counts: {
      activeMembers: s.members.active,
      admins: s.members.admins,
      members: s.members.total,
      cycles: s.cycles.total,
      openCycles: s.cycles.open,
      ordersLast30Days: s.ordersLast30Days,
    },
    config: s.config,
    pendingMigrations: s.pendingMigrations,
    lastClosedAt: s.cycles.lastClosedAt,
    paymentMode: s.paymentMode,
    setupCompleted: s.setupCompleted,
  };
}

// The public page /gruppo (drizzle/0053_public_page.sql): which cycle it
// shows and which ways in it offers. Pure: lib/db/public.ts reads the rows,
// app/gruppo/page.tsx draws them.

import type { SignupMode } from "@/lib/membership/signup";

export type PublicCycle = {
  cycleId: string;
  title: string;
  status: "open" | "planned";
  orderOpenAt: Date | null;
  orderCloseAt: Date | null;
  pickupDate: Date | null;
  pickupEndTime: string | null;
  datesTentative: boolean;
  pickupTentative: boolean;
};

/**
 * The next cycle to show a visitor: an open one first (the one closing
 * soonest), else the planned one opening soonest. Only cycles every member
 * may see reach here (lib/db/public.ts); a planned cycle whose dates are all
 * past is not "next" any more.
 */
export function pickPublicCycle(cycles: readonly PublicCycle[], now: Date): PublicCycle | null {
  const time = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
  const open = cycles.filter((c) => c.status === "open").sort((a, b) => time(a.orderCloseAt) - time(b.orderCloseAt));
  if (open.length > 0) return open[0];
  const planned = cycles
    .filter((c) => c.status === "planned")
    .filter((c) => {
      const dates = [c.orderOpenAt, c.orderCloseAt, c.pickupDate].filter((d): d is Date => d !== null);
      return dates.length === 0 || dates.some((d) => d.getTime() >= now.getTime());
    })
    .sort((a, b) => time(a.orderOpenAt ?? a.pickupDate) - time(b.orderOpenAt ?? b.pickupDate));
  return planned[0] ?? null;
}

/** The second button beside "Entra": how a newcomer gets in, if at all. */
export function joinAction(mode: SignupMode): "request" | "open" | null {
  return mode === "request" ? "request" : mode === "open" ? "open" : null;
}

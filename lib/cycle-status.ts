// The life of an order cycle (order_cycles.status): planned → open → closed,
// or cancelled once closed. A planned cycle (drizzle/0048_planned_cycles.sql)
// shows in the calendar and takes products, but members cannot order: every
// order write checks status = 'open'.

export type CycleStatus = "planned" | "open" | "closed" | "cancelled";

/** Before the close: the cycle's terms (fee, deposit, product order) can still change. */
export const BEFORE_CLOSE_STATUSES = ["planned", "open"] as const;

export function isBeforeClose(status: string): boolean {
  return (BEFORE_CLOSE_STATUSES as readonly string[]).includes(status);
}

/** Whether a cycle is settled with the close behind it: closed or cancelled. */
export function isAfterClose(status: string): boolean {
  return status === "closed" || status === "cancelled";
}

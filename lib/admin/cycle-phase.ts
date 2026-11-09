import { dayOf } from "@/lib/calendar";

// Admin → Ciclo, "Da fare ora": what each cycle asks of the admin next, from
// data the app already has (no stored phase, no migration). Suggestions only:
// nothing here blocks an action, and a step done outside the app (the order
// phoned to the supplier) can be marked done on the device.

/** How long after the close a cycle still suggests sending and correcting. */
export const TASK_WINDOW_DAYS = 14;
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type CycleStep =
  /** Open and the order deadline has passed: there is no cron, someone must close it. */
  | "overdue"
  /** Planned, its opening day has come: there is no cron, someone must open it. */
  | "to_open"
  /** Open, deadline ahead. */
  | "open"
  /** Closed, the order sheet never sent from the app. */
  | "to_send"
  /** Closed, its pickup still "da confermare" (drizzle/0050_pickup_tentative.sql). */
  | "to_confirm_pickup"
  /** Closed and sent, no weight, sheet or correction recorded yet. */
  | "to_adjust"
  /** Closed, its first pickup has started, and some members have not collected yet. */
  | "to_collect"
  /** Card cycle whose accounts ask for "Chiudi i conti". */
  | "to_settle";

/** Steps a device may mark as done: the app cannot see a phone call or a delivery exactly as ordered. */
export const DISMISSABLE_STEPS: readonly CycleStep[] = ["to_send", "to_adjust"];

export type CycleFacts = {
  cycleId: string;
  title: string;
  status: string;
  /** For a planned cycle, when its orders should open. */
  orderOpenAt: Date | null;
  /** A planned cycle's "Date indicative": it never opens by itself. */
  datesTentative?: boolean;
  orderCloseAt: Date | null;
  closedAt: Date | null;
  /** Members with an order on the cycle. */
  orderMembers: number;
  /** A supplier_email_sent audit for the cycle. */
  supplierSent: boolean;
  /** A live correction, an imported sheet or per-member shipping on the cycle. */
  adjusted: boolean;
  /** settlementPending() of a card cycle; false for a wallet cycle. */
  settlementPending: boolean;
  /** The first pickup day; null while none is set. */
  pickupDate: Date | null;
  /** "Ritiro da confermare"; absent = confirmed. */
  pickupTentative?: boolean;
  /** Members with an order whose pickup was marked (Admin → Ciclo → Ritiri). */
  pickedUp: number;
};

export type CycleTask = {
  cycleId: string;
  title: string;
  /** The steps still open, in order: the first one not marked done is shown. */
  steps: CycleStep[];
  orderMembers: number;
  /** For "overdue": hours since the deadline; for "open": hours left; for "to_open": hours since the planned opening, null before it. */
  hours: number | null;
  /** For "to_collect": members still to collect. */
  toCollect: number;
  /** For "to_confirm_pickup": the pickup to confirm. */
  pickupDate: Date | null;
};

/** The steps a cycle still asks for, in the order they are done. Empty: nothing to do. */
export function cycleSteps(f: CycleFacts, now: Date, autoOpen = false): CycleStep[] {
  if (f.status === "planned") {
    // It opens by itself at its time (lib/cycles/open-planned.ts): nothing to
    // do unless that time passed and it is still planned.
    if (autoOpen && !f.datesTentative && f.orderOpenAt != null && f.orderOpenAt.getTime() > now.getTime()) return [];
    // From the planned day on, in the group's time zone.
    return f.orderOpenAt != null && dayOf(f.orderOpenAt) <= dayOf(now) ? ["to_open"] : [];
  }
  if (f.status === "open") {
    return f.orderCloseAt && f.orderCloseAt.getTime() <= now.getTime() ? ["overdue"] : ["open"];
  }
  const steps: CycleStep[] = [];
  const recent = f.closedAt != null && now.getTime() - f.closedAt.getTime() <= TASK_WINDOW_DAYS * DAY;
  if (f.status === "closed" && recent && f.orderMembers > 0 && !f.supplierSent) steps.push("to_send");
  // Until the admin confirms it, however long after the close, while the pickup is ahead.
  if (f.status === "closed" && pickupToConfirm(f, now, recent)) steps.push("to_confirm_pickup");
  if (f.status === "closed" && recent && f.orderMembers > 0 && !f.adjusted) steps.push("to_adjust");
  if (f.status === "closed" && recent && pickupsMissing(f, now)) steps.push("to_collect");
  if (f.settlementPending) steps.push("to_settle");
  return steps;
}

/** A pickup "da confermare": in the window after the close, or later while it is still ahead. */
function pickupToConfirm(f: CycleFacts, now: Date, recent: boolean): boolean {
  return Boolean(f.pickupTentative) && f.pickupDate != null && (recent || f.pickupDate.getTime() > now.getTime());
}

/** From its first pickup on, a closed cycle with members who did not collect yet. */
function pickupsMissing(f: CycleFacts, now: Date): boolean {
  return f.pickupDate != null && f.pickupDate.getTime() <= now.getTime() && f.pickedUp < f.orderMembers;
}

const URGENCY: Record<CycleStep, number> = { overdue: 0, to_open: 1, to_settle: 2, to_send: 3, to_confirm_pickup: 4, to_adjust: 5, to_collect: 6, open: 7 };

/**
 * Every cycle with something to do, the most urgent first; among open cycles
 * the earliest deadline, among closed ones the latest close (the cycle just
 * closed is the one being delivered).
 */
export function cycleTasks(cycles: CycleFacts[], now: Date, autoOpen = false): CycleTask[] {
  const tasks = cycles.flatMap((f) => {
    const steps = cycleSteps(f, now, autoOpen);
    if (steps.length === 0) return [];
    const close = f.orderCloseAt?.getTime() ?? null;
    const opening = f.orderOpenAt?.getTime() ?? null;
    const hours =
      f.status === "planned"
        ? opening != null && opening < now.getTime()
          ? Math.floor((now.getTime() - opening) / HOUR)
          : null
        : close == null || f.status !== "open"
          ? null
          : Math.floor(Math.abs(now.getTime() - close) / HOUR);
    const when =
      f.status === "planned"
        ? (opening ?? Number.MAX_SAFE_INTEGER)
        : f.status === "open"
          ? (close ?? Number.MAX_SAFE_INTEGER)
          : -(f.closedAt?.getTime() ?? 0);
    const toCollect = Math.max(0, f.orderMembers - f.pickedUp);
    return [{ task: { cycleId: f.cycleId, title: f.title, steps, orderMembers: f.orderMembers, hours, toCollect, pickupDate: f.pickupDate }, when }];
  });
  return tasks
    .sort((a, b) => URGENCY[a.task.steps[0]] - URGENCY[b.task.steps[0]] || a.when - b.when)
    .map((x) => x.task);
}

/** The step to show: the first one this device has not marked done. */
export function currentStep(task: CycleTask, done: ReadonlySet<string>): CycleStep | null {
  return task.steps.find((s) => !(DISMISSABLE_STEPS.includes(s) && done.has(doneKey(task.cycleId, s)))) ?? null;
}

export function doneKey(cycleId: string, step: CycleStep): string {
  return `${cycleId}:${step}`;
}

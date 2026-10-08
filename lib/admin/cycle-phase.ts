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
  /** Open, deadline ahead. */
  | "open"
  /** Closed, the order sheet never sent from the app. */
  | "to_send"
  /** Closed and sent, no weight, sheet or correction recorded yet. */
  | "to_adjust"
  /** Card cycle whose accounts ask for "Chiudi i conti". */
  | "to_settle";

/** Steps a device may mark as done: the app cannot see a phone call or a delivery exactly as ordered. */
export const DISMISSABLE_STEPS: readonly CycleStep[] = ["to_send", "to_adjust"];

export type CycleFacts = {
  cycleId: string;
  title: string;
  status: string;
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
};

export type CycleTask = {
  cycleId: string;
  title: string;
  /** The steps still open, in order: the first one not marked done is shown. */
  steps: CycleStep[];
  orderMembers: number;
  /** For "overdue": hours since the deadline; for "open": hours left. */
  hours: number | null;
};

/** The steps a cycle still asks for, in the order they are done. Empty: nothing to do. */
export function cycleSteps(f: CycleFacts, now: Date): CycleStep[] {
  if (f.status === "open") {
    return f.orderCloseAt && f.orderCloseAt.getTime() <= now.getTime() ? ["overdue"] : ["open"];
  }
  const steps: CycleStep[] = [];
  const recent = f.closedAt != null && now.getTime() - f.closedAt.getTime() <= TASK_WINDOW_DAYS * DAY;
  if (f.status === "closed" && recent && f.orderMembers > 0) {
    if (!f.supplierSent) steps.push("to_send");
    if (!f.adjusted) steps.push("to_adjust");
  }
  if (f.settlementPending) steps.push("to_settle");
  return steps;
}

const URGENCY: Record<CycleStep, number> = { overdue: 0, to_settle: 1, to_send: 2, to_adjust: 3, open: 4 };

/**
 * Every cycle with something to do, the most urgent first; among open cycles
 * the earliest deadline, among closed ones the latest close (the cycle just
 * closed is the one being delivered).
 */
export function cycleTasks(cycles: CycleFacts[], now: Date): CycleTask[] {
  const tasks = cycles.flatMap((f) => {
    const steps = cycleSteps(f, now);
    if (steps.length === 0) return [];
    const close = f.orderCloseAt?.getTime() ?? null;
    const hours =
      close == null || f.status !== "open"
        ? null
        : Math.floor(Math.abs(now.getTime() - close) / HOUR);
    const when = f.status === "open" ? (close ?? Number.MAX_SAFE_INTEGER) : -(f.closedAt?.getTime() ?? 0);
    return [{ task: { cycleId: f.cycleId, title: f.title, steps, orderMembers: f.orderMembers, hours }, when }];
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

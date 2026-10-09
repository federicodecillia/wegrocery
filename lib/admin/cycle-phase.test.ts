import { describe, expect, it } from "vitest";
import { currentStep, cycleSteps, cycleTasks, doneKey, type CycleFacts } from "./cycle-phase";

const now = new Date("2026-10-08T12:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3_600_000);
const facts = (over: Partial<CycleFacts>): CycleFacts => ({
  cycleId: "cyc_1",
  title: "Ciclo",
  status: "closed",
  orderCloseAt: h(-48),
  closedAt: h(-24),
  orderMembers: 3,
  supplierSent: false,
  adjusted: false,
  settlementPending: false,
  ...over,
});

describe("cycleSteps", () => {
  it("an open cycle past its deadline must be closed", () => {
    expect(cycleSteps(facts({ status: "open", orderCloseAt: h(-5), closedAt: null }), now)).toEqual(["overdue"]);
    expect(cycleSteps(facts({ status: "open", orderCloseAt: h(5), closedAt: null }), now)).toEqual(["open"]);
    expect(cycleSteps(facts({ status: "open", orderCloseAt: null, closedAt: null }), now)).toEqual(["open"]);
  });

  it("a closed cycle goes send, correct, settle", () => {
    expect(cycleSteps(facts({ settlementPending: true }), now)).toEqual(["to_send", "to_adjust", "to_settle"]);
    expect(cycleSteps(facts({ supplierSent: true }), now)).toEqual(["to_adjust"]);
    expect(cycleSteps(facts({ supplierSent: true, adjusted: true }), now)).toEqual([]);
  });

  it("old or empty cycles only keep the settlement", () => {
    const old = facts({ closedAt: h(-24 * 15), settlementPending: true });
    expect(cycleSteps(old, now)).toEqual(["to_settle"]);
    expect(cycleSteps(facts({ orderMembers: 0 }), now)).toEqual([]);
    expect(cycleSteps(facts({ status: "cancelled", settlementPending: true }), now)).toEqual(["to_settle"]);
    expect(cycleSteps(facts({ status: "cancelled" }), now)).toEqual([]);
  });
});

describe("cycleTasks", () => {
  it("puts the overdue close first, then settlements, sends, corrections, open cycles", () => {
    const tasks = cycleTasks(
      [
        facts({ cycleId: "open", status: "open", orderCloseAt: h(30), closedAt: null }),
        facts({ cycleId: "send" }),
        facts({ cycleId: "settle", supplierSent: true, adjusted: true, settlementPending: true }),
        facts({ cycleId: "late", status: "open", orderCloseAt: h(-5), closedAt: null }),
        facts({ cycleId: "done", supplierSent: true, adjusted: true }),
      ],
      now,
    );
    expect(tasks.map((t) => t.cycleId)).toEqual(["late", "settle", "send", "open"]);
    expect(tasks[0].hours).toBe(5);
    expect(tasks[3].hours).toBe(30);
    expect(tasks[1].hours).toBeNull();
  });

  it("among closed cycles shows the latest close first", () => {
    const tasks = cycleTasks([facts({ cycleId: "older", closedAt: h(-72) }), facts({ cycleId: "newer", closedAt: h(-2) })], now);
    expect(tasks.map((t) => t.cycleId)).toEqual(["newer", "older"]);
  });
});

describe("currentStep", () => {
  const [task] = cycleTasks([facts({ settlementPending: true })], now);
  it("skips the steps this device marked done, never a settlement", () => {
    expect(currentStep(task, new Set())).toBe("to_send");
    expect(currentStep(task, new Set([doneKey("cyc_1", "to_send")]))).toBe("to_adjust");
    const all = new Set([doneKey("cyc_1", "to_send"), doneKey("cyc_1", "to_adjust"), doneKey("cyc_1", "to_settle")]);
    expect(currentStep(task, all)).toBe("to_settle");
  });
  it("is null when every step is marked done", () => {
    const [t] = cycleTasks([facts({})], now);
    expect(currentStep(t, new Set([doneKey("cyc_1", "to_send"), doneKey("cyc_1", "to_adjust")]))).toBeNull();
  });
});

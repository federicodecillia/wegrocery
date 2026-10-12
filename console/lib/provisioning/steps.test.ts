import { describe, expect, it } from "vitest";
import {
  STEPS,
  appPlan,
  canReopen,
  canRun,
  canSkip,
  currentStep,
  databasePlan,
  emailPhase,
  isComplete,
  stepStates,
  type StepStates,
} from "./steps";

const all = (status: "done" | "todo"): StepStates =>
  Object.fromEntries(STEPS.map((s) => [s.id, status])) as StepStates;

describe("wizard planner", () => {
  it("starts at the first step", () => {
    expect(currentStep(stepStates([]))).toBe("anagrafica");
  });

  it("ignores unknown rows and statuses", () => {
    const s = stepStates([{ step: "nope", status: "done" }, { step: "app", status: "weird" }]);
    expect(s.app).toBe("todo");
  });

  it("resumes at the first unsettled step whose prerequisites are settled", () => {
    const s = stepStates([
      { step: "anagrafica", status: "done" },
      { step: "identita", status: "done" },
      { step: "database", status: "failed" },
    ]);
    expect(currentStep(s)).toBe("database");
    expect(canRun("app", s)).toBe(false);
  });

  it("lets a failed step be retried", () => {
    const s = stepStates([{ step: "anagrafica", status: "done" }, { step: "database", status: "failed" }]);
    expect(canRun("database", s)).toBe(true);
  });

  it("publishes only after email and payments are settled", () => {
    const s = { ...all("done"), pagamenti: "todo", pubblica: "todo", dominio: "todo", consegna: "todo" } as StepStates;
    expect(canRun("pubblica", s)).toBe(false);
    expect(currentStep(s)).toBe("pagamenti");
    expect(canSkip("pagamenti", s)).toBe(true);
    const skipped = { ...s, pagamenti: "skipped" } as StepStates;
    expect(canRun("pubblica", skipped)).toBe(true);
    expect(currentStep(skipped)).toBe("pubblica");
  });

  it("never skips a required step", () => {
    expect(canSkip("email", all("done"))).toBe(false);
    expect(canSkip("anagrafica", stepStates([]))).toBe(false);
  });

  it("is complete when everything is done or skipped", () => {
    expect(isComplete(all("done"))).toBe(true);
    expect(isComplete({ ...all("done"), dominio: "skipped" })).toBe(true);
    expect(isComplete({ ...all("done"), consegna: "failed" })).toBe(false);
    expect(currentStep(all("done"))).toBeNull();
  });

  it("reopens a step only when nothing after it ran", () => {
    const s = stepStates([{ step: "anagrafica", status: "done" }, { step: "identita", status: "done" }]);
    expect(canReopen("identita", s)).toBe(true);
    expect(canReopen("anagrafica", s)).toBe(false);
    expect(canReopen("dominio", all("done"))).toBe(true);
  });
});

describe("idempotency plans", () => {
  const none = { neonProjectId: null, vercelProjectId: null, resendDomainId: null };
  it("creates a Neon project only once", () => {
    expect(databasePlan(none).createProject).toBe(true);
    expect(databasePlan({ ...none, neonProjectId: "p" }).createProject).toBe(false);
  });
  it("creates a Vercel project only once and needs the database", () => {
    expect(appPlan(none)).toEqual({ createProject: true, requiresDatabase: true });
    expect(appPlan({ ...none, neonProjectId: "p", vercelProjectId: "v" })).toEqual({ createProject: false, requiresDatabase: false });
  });
  it("walks the email phases", () => {
    expect(emailPhase(null, null, null)).toBe("choose");
    expect(emailPhase("shared_domain", null, null)).toBe("create_key");
    expect(emailPhase("group_domain", null, null)).toBe("create_domain");
    expect(emailPhase("group_domain", "d", "pending")).toBe("await_dns");
    expect(emailPhase("group_domain", "d", "verified")).toBe("create_key");
  });
});

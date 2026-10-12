// The provisioning wizard's steps and the rules that order them, pure. The
// statuses live in `provisioning_steps`; each step's action is idempotent,
// so a failed step is retried by running it again and the wizard resumes at
// the first step not yet settled.

export type StepId =
  | "anagrafica"
  | "identita"
  | "database"
  | "app"
  | "email"
  | "pagamenti"
  | "pubblica"
  | "dominio"
  | "consegna";

export type StepStatus = "todo" | "done" | "failed" | "skipped";

export interface StepDef {
  id: StepId;
  label: string;
  optional: boolean;
  /** Steps that must be settled (done or skipped) first. */
  requires: StepId[];
}

export const STEPS: StepDef[] = [
  { id: "anagrafica", label: "Anagrafica", optional: false, requires: [] },
  { id: "identita", label: "Identità iniziale", optional: false, requires: ["anagrafica"] },
  { id: "database", label: "Database (Neon)", optional: false, requires: ["anagrafica"] },
  { id: "app", label: "App (Vercel)", optional: false, requires: ["identita", "database"] },
  { id: "email", label: "Email (Resend)", optional: false, requires: ["app"] },
  { id: "pagamenti", label: "Pagamenti (Stripe)", optional: true, requires: ["app"] },
  { id: "pubblica", label: "Pubblica", optional: false, requires: ["email", "pagamenti"] },
  { id: "dominio", label: "Dominio", optional: true, requires: ["pubblica"] },
  { id: "consegna", label: "Consegna", optional: false, requires: ["pubblica"] },
];

export const STEP_IDS = STEPS.map((s) => s.id);

export function isStepId(v: string): v is StepId {
  return (STEP_IDS as string[]).includes(v);
}

export function stepDef(id: StepId): StepDef {
  return STEPS.find((s) => s.id === id)!;
}

export type StepStates = Record<StepId, StepStatus>;

export function stepStates(rows: { step: string; status: string }[]): StepStates {
  const out = Object.fromEntries(STEP_IDS.map((id) => [id, "todo"])) as StepStates;
  for (const r of rows) {
    if (isStepId(r.step) && ["todo", "done", "failed", "skipped"].includes(r.status)) out[r.step] = r.status as StepStatus;
  }
  return out;
}

export const isSettled = (s: StepStatus) => s === "done" || s === "skipped";

/** Every prerequisite is settled: the step's action may run (again). */
export function canRun(id: StepId, states: StepStates): boolean {
  return stepDef(id).requires.every((r) => isSettled(states[r]));
}

export function canSkip(id: StepId, states: StepStates): boolean {
  return stepDef(id).optional && canRun(id, states) && states[id] !== "done";
}

/** The step to show: the first one not settled whose prerequisites are. */
export function currentStep(states: StepStates): StepId | null {
  for (const s of STEPS) if (!isSettled(states[s.id]) && canRun(s.id, states)) return s.id;
  return null;
}

export function isComplete(states: StepStates): boolean {
  return STEPS.every((s) => isSettled(states[s.id]));
}

/**
 * A step that is done can be reopened only if nothing after it has run yet,
 * except the optional ones, which can always be redone (e.g. a new domain).
 */
export function canReopen(id: StepId, states: StepStates): boolean {
  if (stepDef(id).optional) return true;
  return !STEPS.some((s) => s.requires.includes(id) && states[s.id] === "done");
}

// --- Per-step idempotency plans ---------------------------------------------

export interface InstanceIds {
  neonProjectId: string | null;
  vercelProjectId: string | null;
  resendDomainId: string | null;
}

/** Database step: create the Neon project only when none is recorded. */
export function databasePlan(ids: InstanceIds): { createProject: boolean } {
  return { createProject: !ids.neonProjectId };
}

/**
 * App step: create (or adopt, on a name clash) the Vercel project only when
 * none is recorded; the env vars are upserted every run.
 */
export function appPlan(ids: InstanceIds): { createProject: boolean; requiresDatabase: boolean } {
  return { createProject: !ids.vercelProjectId, requiresDatabase: !ids.neonProjectId };
}

export type EmailMode = "group_domain" | "shared_domain";

export type EmailPhase = "choose" | "create_domain" | "await_dns" | "create_key";

/** Where the email step stands for the group-domain option. */
export function emailPhase(mode: EmailMode | null, domainId: string | null, domainStatus: string | null): EmailPhase {
  if (!mode) return "choose";
  if (mode === "shared_domain") return "create_key";
  if (!domainId) return "create_domain";
  return domainStatus === "verified" ? "create_key" : "await_dns";
}

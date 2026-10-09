// The first-run setup's steps (app/admin/avvio), in order. Pure: the page
// reads ?step= through stepIndex.
export const SETUP_STEPS = ["identity", "contacts", "payments", "group", "checks", "finish"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function stepIndex(raw: string | undefined): number {
  const i = SETUP_STEPS.indexOf(raw as SetupStep);
  return i === -1 ? 0 : i;
}

export const setupHref = (step: SetupStep) => `/admin/avvio?step=${step}`;

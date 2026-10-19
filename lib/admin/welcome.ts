// The welcome card at the top of Admin (components/admin/admin-welcome-card.tsx):
// a short tour of the admin's work for someone new to it, with the steps the
// group's rows already show as done ticked (FlyLabs Playbook 4.4). Pure; the
// texts are in lib/i18n (t.adminWelcome).

import { ADMIN_GUIDE_HREF, adminHref } from "./nav";

export type AdminWelcomeStep = "todo" | "cycle" | "close" | "treasury" | "members" | "guide";

/** The steps shown: the treasury one only where members keep a balance. */
export function adminWelcomeSteps(wallet: boolean): AdminWelcomeStep[] {
  return ["todo", "cycle", "close", ...(wallet ? (["treasury"] as const) : []), "members", "guide"];
}

/** What the database says the group has done already. */
export type AdminWelcomeFacts = {
  // Any cycle, open, closed or cancelled.
  cycle: boolean;
  // A closed cycle.
  closed: boolean;
  // A live top-up on any account.
  topup: boolean;
  // Someone besides the admins.
  members: boolean;
};

export function adminWelcomeDone(facts: AdminWelcomeFacts): AdminWelcomeStep[] {
  const done: AdminWelcomeStep[] = [];
  if (facts.cycle) done.push("cycle");
  if (facts.closed) done.push("close");
  if (facts.topup) done.push("treasury");
  if (facts.members) done.push("members");
  return done;
}

// Where each step's link goes: a place in Admin or the admin guide.
export const ADMIN_WELCOME_LINKS: Record<AdminWelcomeStep, string> = {
  todo: adminHref("ciclo"),
  cycle: `${ADMIN_GUIDE_HREF}/ciclo#aprire-ciclo`,
  close: `${ADMIN_GUIDE_HREF}/ciclo#chiudere-ciclo`,
  treasury: adminHref("cassa"),
  members: adminHref("soci"),
  guide: ADMIN_GUIDE_HREF,
};

// The admin guide's "Rivedi il benvenuto" opens Admin with this query.
export const ADMIN_WELCOME_QUERY = "benvenuto";
export const ADMIN_WELCOME_REOPEN_HREF = adminHref("ciclo", null, { [ADMIN_WELCOME_QUERY]: "1" });

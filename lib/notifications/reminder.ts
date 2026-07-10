// Pure helpers for the cycle notifications that depend on time and membership
// (cycle opened + closing reminder). Kept side-effect-free so they can be unit
// tested; the DB reads and dispatch live in the cron route and admin actions.

import { canAccessCycle } from "@/lib/utils";

export const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// True when `orderCloseAt` is still in the future but within the reminder
// window from `now` (i.e. (now, now + windowMs]). Null close → never.
export function isInReminderWindow(
  orderCloseAt: Date | null | undefined,
  now: Date,
  windowMs: number = REMINDER_WINDOW_MS,
): boolean {
  if (!orderCloseAt) return false;
  const close = orderCloseAt.getTime();
  const t = now.getTime();
  return close > t && close <= t + windowMs;
}

export type MemberForTargeting = {
  memberId: string;
  email: string;
  role: string;
  active: boolean;
};

// Active members who can see a cycle with the given access level — the
// audience for the "cycle opened" broadcast. Reuses the same gate as the
// order form (canAccessCycle), so an admin-only cycle only reaches admins.
export function selectCycleAccessMembers<T extends MemberForTargeting>(
  members: ReadonlyArray<T>,
  accessLevel: string,
): T[] {
  return members.filter((m) => m.active && canAccessCycle(accessLevel, m.role));
}

// Audience for the closing reminder: cycle-access members who have NOT ordered
// yet in this cycle.
export function selectReminderTargets<T extends MemberForTargeting>(
  members: ReadonlyArray<T>,
  accessLevel: string,
  orderedMemberIds: ReadonlySet<string>,
): T[] {
  return selectCycleAccessMembers(members, accessLevel).filter(
    (m) => !orderedMemberIds.has(m.memberId),
  );
}

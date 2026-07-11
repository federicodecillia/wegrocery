// Pure helpers for the cycle notifications that depend on time and membership
// (cycle opened + closing reminder). Kept side-effect-free so they can be unit
// tested; the DB reads and dispatch live in the cron route and admin actions.

import { canAccessCycle } from "@/lib/utils";

// Length of the "closing soon" window. The cron route expresses the same
// bound as a SQL predicate (order_close_at BETWEEN now and now + this); keeping
// the constant here means both refer to a single source.
// 3h, not 2h: GitHub throttles the */15 cron to real gaps of up to ~2h on
// low-activity repos (observed 2026-07-10), and a gap longer than the window
// skips the reminder entirely. The CAS dedup still guarantees a single send.
export const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

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

// Pure helpers for the cycle notifications that depend on time and membership
// (cycle opened + closing reminder). Kept side-effect-free so they can be unit
// tested; the DB reads and dispatch live in the cron route and admin actions.

import { canAccessCycle } from "@/lib/utils";

// Length of the "closing soon" window. The cron route expresses the same
// bound as a SQL predicate (order_close_at BETWEEN now and now + this); keeping
// the constant here means both refer to a single source.
//
// The window has to be wider than the longest gap between two successful cron
// pings, or a cycle closing inside that gap is never reminded at all. It is
// sized from measurement, not from what the schedule claims. Over 2026-07-30 to
// 2026-08-07 the `*/15` schedule (~744 runs due) actually fired 100 times — 13%
// — because GitHub throttles scheduled workflows on low-activity repos. Median
// gap 1.5h, longest ordinary gap 3.9h, so the previous 3h window was already
// too tight and had been silently dropping reminders.
//
// 6h covers the observed worst case with headroom. It does not cover a GitHub
// incident: on 2026-08-06 two queued jobs were cancelled without running a
// single step, leaving a 10.2h hole. Removing that failure mode means moving
// off GitHub cron entirely — tracked separately.
//
// Widening is safe on both sides: the CAS on closing_reminder_sent_at still
// guarantees exactly one send per cycle, and the copy names the closing time
// explicitly rather than promising "in N hours".
export const REMINDER_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

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

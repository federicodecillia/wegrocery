// Pure helper for the "cycle opened" broadcast audience. Kept side-effect-free
// so it can be unit tested; the DB reads and dispatch live in the admin actions.

import { canAccessCycle } from "@/lib/utils";

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

// Pure helper for the "pickup changed" notice: decides whether saving a cycle
// moved its pickup (first or second day, or their end times) and writes the
// notice. Kept side-effect-free so it can be unit tested; the DB reads and the
// dispatch live in adminUpdateCycle (lib/actions/admin.ts).

import { t } from "@/lib/i18n";
import { formatPickups } from "@/lib/i18n/deadline";

export type CyclePickup = {
  pickupDate: Date | null;
  pickupEndTime: string | null;
  pickup2Date: Date | null;
  pickup2EndTime: string | null;
};

export type PickupChange = "added" | "changed" | "removed";

// A second pickup without a first one is not shown anywhere (formatPickups),
// so it does not count as a pickup either.
function slots(p: CyclePickup): string[] {
  return formatPickups(
    p.pickupDate ? { date: p.pickupDate, endTime: p.pickupEndTime } : null,
    p.pickup2Date ? { date: p.pickup2Date, endTime: p.pickup2EndTime } : null,
  );
}

/**
 * What a save did to the pickup, as members read it: null when the pickup
 * reads the same (no change, or an edit that does not show, like an end time
 * on a day with no hours). Compared on the formatted text on purpose: the
 * notice is worth sending only when what the member sees has changed.
 */
export function pickupChange(before: CyclePickup, after: CyclePickup): PickupChange | null {
  const was = slots(before);
  const now = slots(after);
  if (was.join("\n") === now.join("\n")) return null;
  if (was.length === 0) return "added";
  if (now.length === 0) return "removed";
  return "changed";
}

/** Title and body of the notice, or null when the pickup did not change. */
export function pickupNotice(
  cycleTitle: string,
  before: CyclePickup,
  after: CyclePickup,
): { title: string; body: string } | null {
  const change = pickupChange(before, after);
  if (!change) return null;
  const s = t.notificationsServer;
  const now = slots(after).join(", ");
  switch (change) {
    case "added":
      return { title: s.pickupAddedTitle(cycleTitle), body: s.pickupAddedBody(cycleTitle, now) };
    case "removed":
      return { title: s.pickupChangedTitle(cycleTitle), body: s.pickupRemovedBody(cycleTitle) };
    case "changed":
      return {
        title: s.pickupChangedTitle(cycleTitle),
        body: s.pickupChangedBody(cycleTitle, now, slots(before).join(", ")),
      };
  }
}

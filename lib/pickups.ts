// The pickup register of a closed cycle (Admin → Ciclo → Ritiri,
// drizzle/0046_cycle_pickups.sql): pure rules, unit tested. The reads and
// writes live in lib/actions/admin-pickups.ts.

import { t } from "@/lib/i18n";
import { zonedLocalToUtc } from "@/lib/i18n/zoned-time";

export const PICKUP_NOTE_MAX = 500;
export const PICKUP_COLLECTED_BY_MAX = 120;
/** A pickup time typed a little ahead (a slow clock, a minute rounded up) is still accepted. */
const FUTURE_SLACK_MS = 10 * 60_000;

export type PickupForm = {
  /** "YYYY-MM-DDTHH:mm" in the app time zone; empty = now. */
  pickedUpAt?: string | null;
  collectedBy?: string | null;
  note?: string | null;
};

export type PickupValues = { pickedUpAt: Date; collectedBy: string | null; note: string | null };

function clean(value: string | null | undefined): string | null {
  const v = value?.trim().replace(/\s+/g, " ") ?? "";
  return v === "" ? null : v;
}

/** The values to store, or the message to show. */
export function readPickupForm(form: PickupForm, now: Date): PickupValues | { error: string } {
  const p = t.admin.pickups;
  let pickedUpAt = now;
  const typed = form.pickedUpAt?.trim();
  if (typed) {
    const at = zonedLocalToUtc(typed);
    if (!at) return { error: p.errors.timeInvalid };
    if (at.getTime() > now.getTime() + FUTURE_SLACK_MS) return { error: p.errors.timeFuture };
    pickedUpAt = at;
  }
  const collectedBy = clean(form.collectedBy);
  if (collectedBy && collectedBy.length > PICKUP_COLLECTED_BY_MAX) return { error: p.errors.collectedByTooLong(PICKUP_COLLECTED_BY_MAX) };
  // A note keeps its line breaks.
  const note = form.note?.trim() ? form.note.trim() : null;
  if (note && note.length > PICKUP_NOTE_MAX) return { error: p.errors.noteTooLong(PICKUP_NOTE_MAX) };
  return { pickedUpAt, collectedBy, note };
}

/** Why a cycle cannot take pickups yet, or null when it can. */
export function pickupRefusal(status: string): string | null {
  const p = t.admin.pickups;
  if (status === "closed") return null;
  if (status === "open") return p.errors.cycleOpen;
  return p.errors.cycleCancelled;
}

export type PickupProgress = { done: number; total: number };

/** "8/10": members with an order whose pickup was marked, out of those with an order. */
export function pickupProgressLabel({ done, total }: PickupProgress): string {
  return done >= total ? t.admin.pickups.allCollected : t.admin.pickups.progress(done, total);
}

// "Aggiungi al calendario" on /calendario: a cycle's dates as calendar events
// (lib/ics.ts, the kit module `ics`): the opening of a planned cycle, the last
// moment to order with a reminder, each pickup. Pure, unit tested; the route
// is app/calendario/ics/[cycleId]/route.ts.

import { isZonedMidnight } from "@/lib/i18n/deadline";
import { utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/i18n/zoned-time";
import { buildIcs, type IcsEvent } from "@/lib/ics";

export type IcsCycle = {
  cycleId: string;
  title: string;
  supplierName: string | null;
  /** Planned cycles: when the orders open; null otherwise. */
  opensAt: Date | null;
  closeAt: Date | null;
  pickups: { at: Date; endTime: string | null }[];
  /** "Ritiro da confermare": the pickups say so in their title. */
  pickupTentative?: boolean;
  /** The calendar page, linked from each event. */
  url: string | null;
};

export type IcsText = {
  opens: (title: string) => string;
  closes: (title: string) => string;
  pickup: (title: string) => string;
  pickupTentative: (title: string) => string;
  closesAlarm: string;
};

export const CALENDAR_PRODUCT_ID = "-//WeGrocery//Calendario ordini//IT";

const MINUTE = 60_000;
const CLOSE_ALARM_MINUTES = 180;

export function cycleEvents(cycle: IcsCycle, text: IcsText): IcsEvent[] {
  const name = cycle.supplierName ? `${cycle.title} (${cycle.supplierName})` : cycle.title;
  const uid = (kind: string) => `${cycle.cycleId}-${kind}@wegrocery`;
  const url = cycle.url;
  const events: IcsEvent[] = [];

  if (cycle.opensAt) {
    events.push({ uid: uid("opens"), summary: text.opens(name), url, start: cycle.opensAt, end: new Date(cycle.opensAt.getTime() + 30 * MINUTE) });
  }
  if (cycle.closeAt) {
    // A close at 00:00 is the end of the day before: the event sits just before it.
    events.push({
      uid: uid("closes"),
      summary: text.closes(name),
      url,
      start: new Date(cycle.closeAt.getTime() - 30 * MINUTE),
      end: cycle.closeAt,
      alarm: { minutesBefore: CLOSE_ALARM_MINUTES, text: text.closesAlarm },
    });
  }
  cycle.pickups.forEach((p, i) => {
    const day = utcToZonedLocalInput(p.at).slice(0, 10);
    const base = { uid: uid(`pickup-${i + 1}`), summary: (cycle.pickupTentative ? text.pickupTentative : text.pickup)(name), url };
    // A pickup stored at 00:00 in the group's zone has a day and no time.
    if (isZonedMidnight(p.at)) {
      events.push({ ...base, day });
      return;
    }
    const end = (p.endTime && zonedLocalToUtc(`${day}T${p.endTime}`)) || new Date(p.at.getTime() + 60 * MINUTE);
    events.push({ ...base, start: p.at, end: end.getTime() > p.at.getTime() ? end : new Date(p.at.getTime() + 60 * MINUTE) });
  });
  return events;
}

export function buildCycleIcs(cycle: IcsCycle, text: IcsText, now: Date): string {
  return buildIcs(cycleEvents(cycle, text), { productId: CALENDAR_PRODUCT_ID, now });
}

import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";

// The notification list grouped by day in the app's time zone: "Oggi",
// "Ieri", then "lunedì 6 ottobre". Items keep their order (newest first).

const DAY_MS = 86_400_000;

function dayKey(d: Date): string {
  return utcToZonedLocalInput(d).slice(0, 10);
}

export function groupByDay<T extends { createdAt: Date }>(items: T[], now: Date): { key: string; label: string; items: T[] }[] {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    const label =
      key === today
        ? t.notifications.today
        : key === yesterday
          ? t.notifications.yesterday
          : formatDate(item.createdAt, { weekday: "long", day: "numeric", month: "long" });
    groups.push({ key, label, items: [item] });
  }
  return groups;
}

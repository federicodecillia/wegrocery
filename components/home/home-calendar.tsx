import { KindIcon } from "@/components/calendar/kind-icon";
import { Badge } from "@/components/ui/badge";
import { shiftDay, type UpcomingEvent } from "@/lib/calendar";
import { t } from "@/lib/i18n";
import { formatDate, formatTime } from "@/lib/i18n/format";
import { HomeSection } from "./home-section";

// Home, first section: the next few dates across the cycles (orders open,
// close, pickups, planned cycles included); the heading links /calendario.
// `today` comes from the server, in the group's time zone.
export function HomeCalendar({ upcoming, today }: { upcoming: UpcomingEvent[]; today: string }) {
  const c = t.calendar;
  const tomorrow = shiftDay(today, 1);
  const when = ({ event }: UpcomingEvent) => {
    const day =
      event.day === today
        ? t.cycle.today
        : event.day === tomorrow
          ? t.cycle.tomorrow
          : formatDate(event.at, { weekday: "short", day: "numeric", month: "short" });
    return `${day}, ${formatTime(event.at)}${event.endTime ? `–${event.endTime}` : ""}`;
  };

  return (
    <HomeSection title={t.home.sectionCalendar} action={{ href: "/calendario", label: t.home.calendarOpen }}>
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        {upcoming.length === 0 ? (
          <p className="px-4 py-3.5 text-[14px] text-secondary-foreground">{t.home.upcomingEmpty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((item) => {
              const { event, entry } = item;
              const label = event.kind === "pickup" && event.second ? c.secondPickup : c.kinds[event.kind];
              return (
                <li key={`${entry.cycleId}-${event.kind}-${event.at}`} className="flex items-start gap-3 px-4 py-3">
                  <KindIcon kind={event.kind} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-foreground">
                      <span className="font-semibold">{label}</span>{" "}
                      <span className="tabular-nums text-secondary-foreground">{when(item)}</span>
                    </p>
                    <p className="truncate text-label text-secondary-foreground">
                      {[entry.title, entry.supplierName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {entry.state === "planned" ? (
                    <Badge variant="brand">{entry.tentative ? c.tentative : c.states.planned}</Badge>
                  ) : (
                    entry.hasOrder && event.kind === "pickup" && <Badge variant="accent">{t.home.yourOrderTag}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </HomeSection>
  );
}

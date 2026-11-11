import Link from "next/link";
import { DAY_ICONS, KIND_ICON } from "@/components/calendar/kind-icon";
import { monthGrid, monthOf, type CalendarEntry } from "@/lib/calendar";
import { dayMarks } from "@/lib/calendar-view";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

const noon = (day: string) => new Date(`${day}T12:00:00Z`);

// Home on a computer: this month at a glance beside the list, drawn like
// "Tutti" on /calendario: the same icons (basket opens, lock last day,
// package pickup, at most DAY_ICONS and "+n") and today as a filled circle.
// A legend under the grid, like /calendario's "Tutti". Read only: the full
// calendar is one click away.
export function HomeMonth({ entries, today }: { entries: CalendarEntry[]; today: string }) {
  const month = monthOf(today);
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(noon(`2024-01-0${i + 1}`), { weekday: "narrow" }));
  return (
    <div className="mb-6 rounded-card border border-border bg-card p-3 shadow-card">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <p className="text-[15px] font-bold capitalize text-foreground">{formatDate(noon(`${month}-15`), { month: "long", year: "numeric" })}</p>
        <Link href="/calendario" className="flex min-h-11 items-center text-[14px] font-semibold text-primary-text">
          {t.home.fullCalendar} <span aria-hidden className="ml-1">→</span>
        </Link>
      </div>
      <table aria-hidden className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {weekdays.map((w, i) => (
              <th key={i} className="pb-1 text-center text-label font-semibold text-muted-foreground">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week[0].day}>
              {week.map(({ day, inMonth }) => (
                <td key={day} className="p-0.5 text-center">
                  {inMonth && <MonthDay day={day} today={today} entries={entries} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-1 pt-2">
        {(["opens", "closes", "pickup"] as const).map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <li key={k} className="flex items-center gap-1 text-label text-secondary-foreground">
              <Icon className="size-3 text-foreground" strokeWidth={2.5} />
              {t.calendar.legend[k]}
            </li>
          );
        })}
        <li className="flex items-center gap-1 text-label text-secondary-foreground">
          <span className="size-3 rounded-full bg-inverse" />
          {t.calendar.legend.today}
        </li>
      </ul>
    </div>
  );
}

function MonthDay({ day, today, entries }: { day: string; today: string; entries: CalendarEntry[] }) {
  const marks = dayMarks(entries, day);
  return (
    <span className="flex h-11 flex-col items-center justify-start gap-0.5 pt-0.5">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums",
          day === today ? "bg-inverse font-bold text-inverse-foreground" : day < today ? "text-secondary-foreground" : "text-foreground",
        )}
      >
        {Number(day.slice(8))}
      </span>
      <span className="flex h-3 items-center gap-0.5">
        {marks.slice(0, DAY_ICONS).map((k, i) => {
          const Icon = KIND_ICON[k];
          return <Icon key={i} aria-hidden className="size-3 text-foreground" strokeWidth={2.5} />;
        })}
        {marks.length > DAY_ICONS && <span className="text-label font-bold leading-none text-foreground">{t.calendar.moreLanes(marks.length - DAY_ICONS)}</span>}
      </span>
    </span>
  );
}

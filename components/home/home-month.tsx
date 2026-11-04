import Link from "next/link";
import { KIND_DOT } from "@/components/calendar/kind-icon";
import { eventKindsByDay, monthGrid, monthOf, type CalendarEntry, type CalendarEventKind } from "@/lib/calendar";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

const KINDS: CalendarEventKind[] = ["opens", "closes", "pickup"];
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

// Home on a computer: this month at a glance beside the list, with the same
// marks as /calendario (round opens, square closes, diamond pickup). Read
// only: the full calendar is one click away.
export function HomeMonth({ entries, today }: { entries: CalendarEntry[]; today: string }) {
  const month = monthOf(today);
  const kinds = eventKindsByDay(entries);
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
                  {inMonth && (
                    <span
                      className={cn(
                        "flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg text-[13px] tabular-nums",
                        day === today ? "bg-primary-bg font-bold text-primary-text" : day < today ? "text-secondary-foreground" : "text-foreground",
                      )}
                    >
                      {Number(day.slice(8))}
                      <span className="flex h-1.5 gap-1">
                        {KINDS.filter((k) => kinds.get(day)?.has(k)).map((k) => (
                          <span key={k} className={cn("size-1.5", KIND_DOT[k])} />
                        ))}
                      </span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

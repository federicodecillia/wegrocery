import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type DateTileTone = "open" | "urgent" | "neutral";

const TONE: Record<DateTileTone, string> = {
  open: "bg-primary-bg text-primary-text",
  urgent: "bg-danger-bg text-destructive",
  neutral: "bg-tint/[0.05] text-foreground",
};

// The calendar on Home without a calendar: the cycle's next date as a small
// tile (weekday over day number) at the start of its row. `day` is
// "YYYY-MM-DD" in the group's time zone.
export function DateTile({ day, tone }: { day: string; tone: DateTileTone }) {
  const noon = new Date(`${day}T12:00:00Z`);
  return (
    <div aria-hidden className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none", TONE[tone])}>
      <span className="text-label font-semibold uppercase">{formatDate(noon, { weekday: "short" })}</span>
      <span className="mt-0.5 text-[19px] font-extrabold tabular-nums">{Number(day.slice(8))}</span>
    </div>
  );
}

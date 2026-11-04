import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateTile, type DateTileTone } from "./date-tile";

// Home → Da ritirare / In arrivo: one cycle as a compact row (a date tile,
// the title, what happens when, a second line), the whole row a link.
export function CycleRow({
  href,
  day,
  tone,
  title,
  when,
  detail,
  badge,
}: {
  href: string;
  /** "YYYY-MM-DD" of the tile; null when the cycle has no such date yet. */
  day: string | null;
  tone: DateTileTone;
  title: string;
  when: string;
  detail?: string | null;
  badge?: string | null;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3">
        {day ? <DateTile day={day} tone={tone} /> : <span aria-hidden className="size-12 shrink-0 rounded-xl bg-tint/[0.05]" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-snug text-foreground">{title}</span>
          <span className="block text-[15px] text-foreground">{when}</span>
          {detail && <span className="block text-[14px] text-secondary-foreground">{detail}</span>}
          {badge && <Badge className="mt-1">{badge}</Badge>}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-secondary-foreground" />
      </Link>
    </li>
  );
}

/** The card holding a group of rows. */
export function CycleRows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">{children}</ul>;
}

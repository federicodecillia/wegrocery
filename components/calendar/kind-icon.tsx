import { Lock, LockOpen, Package } from "lucide-react";
import type { CalendarEventKind } from "@/lib/calendar";
import { cn } from "@/lib/utils";

// The icon of each kind of calendar event, shared by /calendario and Home.
const ICON_COLOR: Record<CalendarEventKind, string> = {
  opens: "text-accent-text",
  closes: "text-primary-text",
  pickup: "text-foreground",
};

export function KindIcon({ kind, className }: { kind: CalendarEventKind; className?: string }) {
  const Icon = kind === "opens" ? LockOpen : kind === "closes" ? Lock : Package;
  return <Icon aria-hidden className={cn("size-4 shrink-0", ICON_COLOR[kind], className)} strokeWidth={2.25} />;
}

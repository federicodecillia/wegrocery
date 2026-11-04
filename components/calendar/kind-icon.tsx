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

// Each kind has its own shape as well as its colour (Playbook 2.5): a round
// dot opens, a square closes, a diamond is a pickup.
export const KIND_DOT: Record<CalendarEventKind, string> = {
  opens: "rounded-full bg-accent",
  closes: "bg-primary",
  pickup: "rotate-45 bg-inverse",
};

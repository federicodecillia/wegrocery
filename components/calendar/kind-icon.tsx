import type { CalendarEventKind } from "@/lib/calendar";

// The marks of each kind of calendar event on Home's month view (HomeMonth).
// Each kind has its own shape as well as its colour (Playbook 2.5): a round
// dot opens, a square closes, a diamond is a pickup.
export const KIND_DOT: Record<CalendarEventKind, string> = {
  opens: "rounded-full bg-accent",
  closes: "bg-primary",
  pickup: "rotate-45 bg-inverse",
};

import { Lock, Package, ShoppingBasket, type LucideIcon } from "lucide-react";
import type { CalendarEventKind } from "@/lib/calendar";

// The icon of each kind of calendar event, the same on /calendario (its day
// cells, legend and card) and on Home's month view (HomeMonth): a basket
// opens, a lock is the last day to order, a package is a pickup. Shape, not
// colour, tells them apart (Playbook 2.5).
export const KIND_ICON: Record<CalendarEventKind, LucideIcon> = {
  opens: ShoppingBasket,
  closes: Lock,
  pickup: Package,
};

/** Icons drawn in a day when every cycle is shown; a busier day adds "+n". */
export const DAY_ICONS = 2;

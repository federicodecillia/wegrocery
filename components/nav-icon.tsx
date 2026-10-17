import { CircleHelp, History, House, ShoppingCart, Star, type LucideIcon } from "lucide-react";
import type { NavIconName } from "@/components/nav-items";

// Navigation icons from lucide (Playbook 2.7), the same stroke as the rest of
// the interface. The admin keeps its star.
const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  order: ShoppingCart,
  history: History,
  guide: CircleHelp,
  admin: Star,
};

export function NavIcon({ name }: { name: NavIconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className="h-5 w-5" />;
}

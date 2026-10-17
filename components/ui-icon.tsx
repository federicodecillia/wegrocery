import { Bell, Book, Compass, Mail, Package, ShoppingBasket, ShoppingCart, User, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";

// Interface icons outside the navigation (guide topics, empty states, the
// contact card), from lucide like nav-icon.tsx (Playbook 2.7). Domain icons
// (movements, movement-icon.tsx) stay hand-drawn; emoji stay for content an
// admin chose (products, categories, the changelog).
export type UiIconName = "compass" | "basket" | "wallet" | "users" | "bell" | "user" | "mail" | "box" | "cart" | "book" | "wrench";

const ICONS: Record<UiIconName, LucideIcon> = {
  compass: Compass,
  basket: ShoppingBasket,
  wallet: Wallet,
  users: Users,
  bell: Bell,
  user: User,
  mail: Mail,
  box: Package,
  cart: ShoppingCart,
  book: Book,
  wrench: Wrench,
};

export function UiIcon({ name, className = "h-5 w-5" }: { name: UiIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}

/** The icon of a guide topic, by its stable id; an unknown id gets a book. */
export function topicIcon(id: string): UiIconName {
  const byId: Record<string, UiIconName> = {
    "primi-passi": "compass",
    ordinare: "basket",
    soldi: "wallet",
    famiglia: "users",
    notifiche: "bell",
    account: "user",
  };
  return byId[id] ?? "book";
}

/** A big icon in a soft circle, on top of an empty state ("no orders yet"). */
export function EmptyIcon({ name }: { name: UiIconName }) {
  return (
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-bg text-primary-text">
      <UiIcon name={name} className="h-7 w-7" />
    </span>
  );
}

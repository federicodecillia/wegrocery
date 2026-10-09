import type { ReactNode } from "react";

// Interface icons outside the navigation (guide topics, empty states, the
// contact card): stroke SVGs in the same style as nav-icon.tsx and
// movement-icon.tsx, so they look the same on every system. Emoji stay for
// content an admin chose (products, categories, the changelog).
export type UiIconName = "compass" | "basket" | "wallet" | "users" | "bell" | "user" | "mail" | "box" | "cart" | "book";

const PATHS: Record<UiIconName, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5" />
    </>
  ),
  basket: (
    <>
      <path d="M5 10h14l-1.5 9.5a1 1 0 0 1-1 .5h-9a1 1 0 0 1-1-.5L5 10z" />
      <path d="M3 10h18" />
      <path d="M9 10l3-6 3 6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="15" r="1" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14a6.5 6.5 0 0 1 3 6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 11h11l2-8H6.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h14" />
    </>
  ),
};

export function UiIcon({ name, className = "h-5 w-5" }: { name: UiIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
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
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-text">
      <UiIcon name={name} className="h-7 w-7" />
    </span>
  );
}

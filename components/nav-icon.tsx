import type { NavIconName } from "@/components/nav-items";

export function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case "home":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M6.75 9.5V21h10.5V9.5" />
        </svg>
      );
    case "order":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M3 4h2l2.5 11h11l2-8H6.5" />
        </svg>
      );
    case "history":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v4h4" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "guide":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 17h.01" />
          <path d="M10.3 9.2a2 2 0 1 1 3.7 1c-.4.6-1 .9-1.4 1.4-.2.2-.3.5-.3 1" />
        </svg>
      );
    case "admin":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.5-4.8-2.5-4.8 2.5.9-5.5L4.2 8.7l5.4-.8z" />
        </svg>
      );
  }
}

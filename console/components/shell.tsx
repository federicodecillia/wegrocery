import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { missingProviderTokens } from "@/lib/env";

const NAV = [
  { href: "/", label: "Istanze" },
  { href: "/richieste", label: "Richieste" },
  { href: "/nuovo", label: "Nuovo gruppo" },
];

/** Frame of every operator page (not of /login and /richiesta). */
export function Shell({ children, current }: { children: ReactNode; current?: string }) {
  const missing = missingProviderTokens();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            WeGrocery Console
          </Link>
          <nav aria-label="Sezioni" className="flex flex-1 flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current === n.href ? "page" : undefined}
                className="rounded-md px-2.5 py-1.5 text-muted hover:bg-bg hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button type="submit" className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-bg hover:text-ink">
              Esci
            </button>
          </form>
        </div>
      </header>
      {missing.length > 0 && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-center text-sm text-warn">
          Variabili non impostate: {missing.join(", ")}. Le funzioni che ne hanno bisogno restano bloccate.
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

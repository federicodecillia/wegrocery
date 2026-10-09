"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n";
import { ADMIN_MORE, ADMIN_PRIMARY, ADMIN_VIEWS, adminHref, resolveAdminRoute } from "@/lib/admin/nav";

function tabClass(active: boolean): string {
  return `flex min-h-10 items-center justify-center rounded-full px-2 text-center text-[13px] font-semibold transition-colors ${
    active ? "bg-white text-brand-near-black shadow-sm" : "text-brand-gray hover:text-brand-near-black"
  }`;
}

// The admin bar: Ciclo · Cassa · Soci · Catalogo, then ⋯ (Statistiche,
// Impostazioni) on a phone, all in line from lg. A section with views shows
// them as a second, lighter row.
export function AdminNav() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { section, view } = resolveAdminRoute(
    searchParams.get("tab") ?? undefined,
    searchParams.get("view") ?? undefined,
    searchParams.get("member") ?? undefined,
    searchParams.get("cycle") ?? undefined,
  );
  const inMore = ADMIN_MORE.some((s) => s.id === section);
  const views = ADMIN_VIEWS[section];
  const more = useRef<HTMLDetailsElement>(null);

  // The ⋯ menu closes after a choice (it stays mounted across navigations).
  useEffect(() => {
    if (more.current) more.current.open = false;
  }, [pathname, searchParams]);

  // ...and on a tap outside or Esc, like any menu.
  useEffect(() => {
    const close = (e: Event) => {
      const el = more.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) {
        el.open = false;
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <div className="mb-4 space-y-2">
      <nav aria-label={t.admin.nav.sections} className="flex gap-1 rounded-full bg-black/[0.05] p-1">
        {ADMIN_PRIMARY.map((s) => (
          <Link
            key={s.id}
            href={adminHref(s.id)}
            aria-current={section === s.id ? "page" : undefined}
            className={`flex-1 ${tabClass(section === s.id)}`}
          >
            {s.label}
          </Link>
        ))}
        {/* From lg the rest sit in line. */}
        {ADMIN_MORE.map((s) => (
          <Link
            key={s.id}
            href={adminHref(s.id)}
            aria-current={section === s.id ? "page" : undefined}
            className={`hidden flex-1 lg:flex ${tabClass(section === s.id)}`}
          >
            {s.label}
          </Link>
        ))}
        <details ref={more} className="relative lg:hidden">
          <summary
            aria-label={t.admin.nav.moreAria}
            className={`list-none [&::-webkit-details-marker]:hidden cursor-pointer min-w-11 ${tabClass(inMore)}`}
          >
            <span aria-hidden className="text-[16px] leading-none">⋯</span>
            {inMore && <span className="sr-only">{ADMIN_MORE.find((s) => s.id === section)?.label}</span>}
          </summary>
          <ul className="absolute right-0 z-30 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-brand-border bg-white py-1 shadow-card">
            {ADMIN_MORE.map((s) => (
              <li key={s.id}>
                <Link
                  href={adminHref(s.id)}
                  aria-current={section === s.id ? "page" : undefined}
                  className={`flex min-h-11 items-center px-4 text-[14px] ${
                    section === s.id ? "font-bold text-primary-text" : "text-brand-near-black hover:bg-black/[0.03]"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </nav>

      {views && (
        <nav aria-label={t.admin.nav.views} className="flex gap-4 border-b border-brand-border px-1">
          {views.map((v) => (
            <Link
              key={v.id}
              href={adminHref(section, v.id)}
              aria-current={view === v.id ? "page" : undefined}
              className={`-mb-px flex min-h-11 items-center border-b-2 text-[14px] font-semibold ${
                view === v.id ? "border-primary text-brand-near-black" : "border-transparent text-brand-gray hover:text-brand-near-black"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

import { t } from "@/lib/i18n";
import { CYCLE_VIEW_LABELS, isCycleView, type CycleView } from "@/lib/admin/cycle-views";

// The admin's navigation: a few sections, some with views, all on one route
// (/admin?tab=<section>&view=<view>) because ~25 actions revalidate
// "/admin". Old links (saved in notifications, bookmarks) keep working:
// resolveAdminRoute maps the former tabs onto their new place.

export type AdminSection = "ciclo" | "cassa" | "soci" | "catalogo" | "statistiche" | "impostazioni";

/** Catalogue views; the cycle's views live in lib/admin/cycle-views.ts. */
export type CatalogView = "prodotti" | "fornitori";

export type AdminView = CatalogView | CycleView;

/** Sections in the bar on a phone; the rest sit behind ⋯ there and in line from a PC. */
export const ADMIN_PRIMARY: { id: AdminSection; label: string }[] = [
  { id: "ciclo", label: t.admin.nav.cycle },
  { id: "cassa", label: t.admin.nav.treasury },
  { id: "soci", label: t.admin.nav.members },
  { id: "catalogo", label: t.admin.nav.catalog },
];

export const ADMIN_MORE: { id: AdminSection; label: string }[] = [
  { id: "statistiche", label: t.admin.nav.stats },
  { id: "impostazioni", label: t.admin.nav.settings },
];

/** The views the bar shows under a section, first one the default (the cycle draws its own). */
export const ADMIN_VIEWS: Partial<Record<AdminSection, { id: CatalogView; label: string }[]>> = {
  catalogo: [
    { id: "prodotti", label: t.admin.nav.catalogProducts },
    { id: "fornitori", label: t.admin.nav.catalogSuppliers },
  ],
};

const SECTIONS = new Set<string>([...ADMIN_PRIMARY, ...ADMIN_MORE].map((s) => s.id));

// The tabs before the new bar, and where each one lives now.
const LEGACY: Record<string, { section: AdminSection; view: AdminView }> = {
  ordini: { section: "ciclo", view: "ordini" },
  prodotti: { section: "catalogo", view: "prodotti" },
  fornitori: { section: "catalogo", view: "fornitori" },
};

/** The section and view a URL asks for; anything unknown is the cycle's overview. */
export function resolveAdminRoute(tab: string | undefined, view: string | undefined): { section: AdminSection; view: AdminView | null } {
  const legacy = tab ? LEGACY[tab] : undefined;
  if (legacy) return legacy;
  const section: AdminSection = tab && SECTIONS.has(tab) ? (tab as AdminSection) : "ciclo";
  // The workspace resolves the cycle's view against the cycle's status.
  if (section === "ciclo") return { section, view: isCycleView(view) ? view : null };
  const views = ADMIN_VIEWS[section];
  if (!views) return { section, view: null };
  return { section, view: views.find((v) => v.id === view)?.id ?? views[0].id };
}

/** The URL of a section (and view), as the bar links to it. */
export function adminHref(section: AdminSection, view?: AdminView | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ tab: section });
  if (view && view !== "panoramica" && view !== ADMIN_VIEWS[section]?.[0].id) params.set("view", view);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return `/admin?${params}`;
}

/** The page title and its h1: the section, plus the view when it is not the default. */
export function adminTitle(tab: string | undefined, view: string | undefined): string {
  const route = resolveAdminRoute(tab, view);
  const section = [...ADMIN_PRIMARY, ...ADMIN_MORE].find((s) => s.id === route.section)!.label;
  if (route.section === "ciclo") {
    return route.view && route.view !== "panoramica" ? `${section}: ${CYCLE_VIEW_LABELS[route.view as CycleView]}` : section;
  }
  const views = ADMIN_VIEWS[route.section];
  if (!views || route.view === views[0].id) return section;
  return `${section}: ${views.find((v) => v.id === route.view)!.label}`;
}

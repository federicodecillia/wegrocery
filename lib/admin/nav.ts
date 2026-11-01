import { t } from "@/lib/i18n";
import { CYCLE_VIEW_LABELS, isCycleView, type CycleView } from "@/lib/admin/cycle-views";

// The admin's navigation: a few sections, some with views, all on one route
// (/admin?tab=<section>&view=<view>) because ~25 actions revalidate
// "/admin". Old links (saved in notifications, bookmarks) keep working:
// resolveAdminRoute maps the former tabs onto their new place.

export type AdminSection = "ciclo" | "cassa" | "soci" | "catalogo" | "statistiche" | "impostazioni";

/** Catalogue views; the cycle's views live in lib/admin/cycle-views.ts. */
export type CatalogView = "prodotti" | "fornitori";

/** Settings views, by topic (components/admin/tab-impostazioni.tsx). */
export type SettingsView = "pagamenti" | "gruppo" | "soci" | "tecniche";

export type AdminView = CatalogView | SettingsView | CycleView;

// The admin guide's index (app/guida/admin): the ⋯ menu and the sidebar link it.
export const ADMIN_GUIDE_HREF = "/guida/admin";

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
export const ADMIN_VIEWS: Partial<Record<AdminSection, { id: CatalogView | SettingsView; label: string }[]>> = {
  catalogo: [
    { id: "prodotti", label: t.admin.nav.catalogProducts },
    { id: "fornitori", label: t.admin.nav.catalogSuppliers },
  ],
  impostazioni: [
    { id: "pagamenti", label: t.admin.nav.settingsPayments },
    { id: "gruppo", label: t.admin.nav.settingsGroup },
    { id: "soci", label: t.admin.nav.settingsMembers },
    { id: "tecniche", label: t.admin.nav.settingsTechnical },
  ],
};

// "Come si fa?" in the admin bar: the admin guide's topic (and card) for the
// section and view on screen. lib/guide/admin/admin-guide.test.ts checks the
// cards exist.
export function adminHelpHref(section: AdminSection, view: AdminView | null): string {
  const card: Record<AdminSection, string> = {
    ciclo: view === "fornitore" ? "fornitore" : view === "prodotti" ? "ciclo#prodotti-nel-ciclo" : view === "ordini" ? "ciclo#seguire-ordini" : view === "ritiri" ? "ciclo#segnare-ritiri" : "ciclo",
    cassa: "cassa",
    soci: "soci",
    catalogo: view === "fornitori" ? "catalogo#aggiungere-fornitore" : "catalogo",
    statistiche: "impostazioni#ricerche-statistiche",
    impostazioni:
      view === "gruppo"
        ? "impostazioni#nome-logo-colori"
        : view === "soci"
          ? "impostazioni#il-nostro-gruppo-admin"
          : view === "tecniche"
            ? "impostazioni#collegare-carta"
            : "impostazioni#modalita-pagamento",
  };
  return `${ADMIN_GUIDE_HREF}/${card[section]}`;
}

const SECTIONS = new Set<string>([...ADMIN_PRIMARY, ...ADMIN_MORE].map((s) => s.id));

/**
 * The sections a "Referente ordini" opens: the cycles (without their
 * accounts), the catalogue and the members, read only. Cassa, Statistiche and
 * Impostazioni stay with the admins.
 */
export const REFERENT_SECTIONS: readonly AdminSection[] = ["ciclo", "soci", "catalogo"];

export function sectionAllowed(section: AdminSection, access: "admin" | "referent"): boolean {
  return access === "admin" || REFERENT_SECTIONS.includes(section);
}

/** The bar's sections for this access, phone row first, then the ⋯ menu. */
export function adminSectionsFor(access: "admin" | "referent"): {
  primary: { id: AdminSection; label: string }[];
  more: { id: AdminSection; label: string }[];
} {
  return {
    primary: ADMIN_PRIMARY.filter((s) => sectionAllowed(s.id, access)),
    more: ADMIN_MORE.filter((s) => sectionAllowed(s.id, access)),
  };
}

// The tabs before the new bar, and where each one lives now.
const LEGACY: Record<string, { section: AdminSection; view: AdminView }> = {
  ordini: { section: "ciclo", view: "ordini" },
  prodotti: { section: "catalogo", view: "prodotti" },
  fornitori: { section: "catalogo", view: "fornitori" },
};

/**
 * The section and view a URL asks for; anything unknown is the cycle's overview.
 * A member's order history moved from Ordini to their page in Soci, so the
 * old `?tab=ordini&member=` (and the cycle's Ordini with only a member) go there.
 */
export function resolveAdminRoute(
  tab: string | undefined,
  view: string | undefined,
  member?: string,
  cycle?: string,
): { section: AdminSection; view: AdminView | null } {
  if (member && !cycle && (tab === "ordini" || (tab === "ciclo" && view === "ordini"))) return { section: "soci", view: null };
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
export function adminTitle(tab: string | undefined, view: string | undefined, member?: string, cycle?: string): string {
  const route = resolveAdminRoute(tab, view, member, cycle);
  const section = [...ADMIN_PRIMARY, ...ADMIN_MORE].find((s) => s.id === route.section)!.label;
  if (route.section === "ciclo") {
    return route.view && route.view !== "panoramica" ? `${section}: ${CYCLE_VIEW_LABELS[route.view as CycleView]}` : section;
  }
  const views = ADMIN_VIEWS[route.section];
  if (!views || route.view === views[0].id) return section;
  return `${section}: ${views.find((v) => v.id === route.view)!.label}`;
}

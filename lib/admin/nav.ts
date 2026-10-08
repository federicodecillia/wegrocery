import { t } from "@/lib/i18n";

/** The admin tabs, in nav order; settings sits apart as a gear. */
export const ADMIN_TABS = [
  { id: "ciclo", label: t.admin.cycle.tabLabel },
  { id: "prodotti", label: t.admin.products.tabLabel },
  { id: "ordini", label: t.admin.orders.tabLabel },
  { id: "cassa", label: t.admin.treasury.tabLabel },
  { id: "soci", label: t.admin.members.tabLabel },
  { id: "fornitori", label: t.admin.suppliers.tabLabel },
  { id: "statistiche", label: t.admin.stats.tabLabel },
] as const;

/** The label of a tab id (the page title and its h1); unknown ids fall back to the first tab. */
export function adminTabLabel(id: string | undefined): string {
  if (id === "impostazioni") return t.admin.settings.tabLabel;
  return (ADMIN_TABS.find((tab) => tab.id === id) ?? ADMIN_TABS[0]).label;
}

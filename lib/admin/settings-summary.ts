import type { ConfigItem } from "@/lib/config-status";

// The one-line summaries of Admin → Impostazioni's folded panels
// (components/admin/settings-panel.tsx): what is set now, read without
// opening. Pure, so the rules are tested apart from the page.

/** The IBAN's last four characters, for "IBAN …1234"; null without one. */
export function ibanTail(iban: string | null | undefined): string | null {
  const compact = (iban ?? "").replace(/\s+/g, "");
  return compact.length >= 4 ? compact.slice(-4).toUpperCase() : null;
}

/**
 * The configuration items an admin should look at: a required one missing, or
 * anything set up but off (warning). An optional integration not set up is a
 * choice, not a problem.
 */
export function configIssues(items: readonly ConfigItem[]): number {
  return items.filter((i) => i.status === "warning" || (i.status === "missing" && i.required)).length;
}

/** Whether a required item is missing: the panel then opens by itself. */
export function configBlocking(items: readonly ConfigItem[]): boolean {
  return items.some((i) => i.status === "missing" && i.required);
}

export type StripeSummaryInput = {
  /** Where the key comes from: none = not connected. */
  source: "env" | "app" | "none";
  /** Saved in the app but its secrets no longer open (AUTH_SECRET changed). */
  unreadable: boolean;
  /** The key passes this environment's checks (no live key outside production...). */
  usable: boolean;
};

/** The state of the card panel: not connected, to check, or connected with its mode. */
export function stripeSummary(s: StripeSummaryInput): { state: "none" | "check" | "connected"; attention: boolean } {
  if (s.source === "none") return { state: "none", attention: false };
  if (s.unreadable || !s.usable) return { state: "check", attention: true };
  return { state: "connected", attention: false };
}

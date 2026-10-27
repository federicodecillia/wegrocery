import { describe, expect, it } from "vitest";
import { ADMIN_WELCOME_LINKS, ADMIN_WELCOME_REOPEN_HREF, adminWelcomeDone, adminWelcomeSteps } from "./welcome";
import { adminGuideIt } from "@/lib/guide/admin/it";
import { adminHelpHref, type AdminSection, type AdminView } from "./nav";
import { it as itText } from "@/lib/i18n/it";
import { en } from "@/lib/i18n/en";

// An admin guide href (/guida/admin/<topic>#<card>) points at a real topic and a card in it.
function guideTarget(href: string): boolean {
  const m = /^\/guida\/admin(?:\/([^#?]+))?(?:#(.+))?$/.exec(href);
  if (!m) return false;
  const [, topic, card] = m;
  if (!topic) return !card;
  if (!adminGuideIt.topics.some((x) => x.id === topic)) return false;
  return !card || adminGuideIt.articles.some((a) => a.slug === card && a.topic === topic);
}

describe("admin welcome", () => {
  it("shows the treasury step only where members keep a balance", () => {
    expect(adminWelcomeSteps(true)).toEqual(["todo", "cycle", "close", "treasury", "members", "guide"]);
    expect(adminWelcomeSteps(false)).toEqual(["todo", "cycle", "close", "members", "guide"]);
  });

  it("ticks what the group has done already", () => {
    expect(adminWelcomeDone({ cycle: false, closed: false, topup: false, members: false })).toEqual([]);
    expect(adminWelcomeDone({ cycle: true, closed: true, topup: true, members: true })).toEqual(["cycle", "close", "treasury", "members"]);
    expect(adminWelcomeDone({ cycle: true, closed: false, topup: false, members: true })).toEqual(["cycle", "members"]);
  });

  it("links to Admin or to cards that exist in the admin guide", () => {
    for (const href of Object.values(ADMIN_WELCOME_LINKS)) {
      expect(href.startsWith("/admin?") || guideTarget(href), href).toBe(true);
    }
    expect(ADMIN_WELCOME_REOPEN_HREF).toBe("/admin?tab=ciclo&benvenuto=1");
  });

  it("has a text for every step in both languages", () => {
    for (const t of [itText, en]) {
      for (const step of adminWelcomeSteps(true)) {
        const s = t.adminWelcome.steps[step];
        expect(s.title && s.body && s.link).toBeTruthy();
        expect(JSON.stringify(s)).not.toContain("—");
      }
    }
  });
});

describe("admin help links", () => {
  const cases: [AdminSection, AdminView | null][] = [
    ["ciclo", null],
    ["ciclo", "prodotti"],
    ["ciclo", "ordini"],
    ["ciclo", "fornitore"],
    ["ciclo", "conti"],
    ["cassa", null],
    ["soci", null],
    ["catalogo", "prodotti"],
    ["catalogo", "fornitori"],
    ["statistiche", null],
    ["impostazioni", null],
    ["impostazioni", "pagamenti"],
    ["impostazioni", "gruppo"],
    ["impostazioni", "soci"],
    ["impostazioni", "tecniche"],
  ];
  it.each(cases)("%s / %s opens a card of the admin guide", (section, view) => {
    expect(guideTarget(adminHelpHref(section, view)), adminHelpHref(section, view)).toBe(true);
  });
});

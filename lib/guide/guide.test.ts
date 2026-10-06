import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guideEn } from "./en";
import { guideIt } from "./it";
import { buildSearchIndex, normalizeText, searchGuide } from "./search";
import { isVisible, visibleGuide, type GuideContent, type GuideContext } from "./types";

const wallet: GuideContext = { mode: "wallet", families: false, onlineTopup: true, bankTransfer: true };
const perOrder: GuideContext = { mode: "per_order", families: true, onlineTopup: true, bankTransfer: false };

const slugs = (g: GuideContent) => g.articles.map((a) => a.slug);

function search(content: GuideContent, ctx: GuideContext, query: string): string[] {
  const g = visibleGuide(content, ctx);
  return searchGuide(buildSearchIndex(g.articles), query, g).map((r) => r.entry.slug);
}

describe("guide content", () => {
  for (const [name, g] of [["it", guideIt], ["en", guideEn]] as const) {
    it(`${name}: slugs are unique and every card has a known topic`, () => {
      expect(new Set(slugs(g)).size).toBe(g.articles.length);
      const topics = new Set(g.topics.map((x) => x.id));
      expect(g.articles.filter((a) => !topics.has(a.topic)).map((a) => a.slug)).toEqual([]);
    });

    it(`${name}: in-app links point at existing pages`, () => {
      const missing = g.articles
        .flatMap((a) => (a.link && a.link.href.startsWith("/") ? [a.link.href] : []))
        .filter((href) => !existsSync(join(process.cwd(), "app", href, "page.tsx")));
      expect(missing).toEqual([]);
    });

    it(`${name}: no em dash in member-facing text`, () => {
      expect(JSON.stringify(g)).not.toContain("—");
    });
  }

  it("every page's \"?\" link opens an existing topic and card", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
      );
    const hrefs = ["app", "components"]
      .flatMap((d) => files(join(process.cwd(), d)))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<HelpLink href="([^"]+)"/g)].map((m) => m[1]));
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
    const broken = hrefs.filter((href) => {
      const [, topic, slug] = /^\/guida\/([^#]+)(?:#(.+))?$/.exec(href) ?? [];
      if (!guideIt.topics.some((x) => x.id === topic)) return true;
      return slug !== undefined && !guideIt.articles.some((a) => a.slug === slug && a.topic === topic);
    });
    expect(broken).toEqual([]);
  });

  it("Italian and English have the same cards, conditions, steps and links", () => {
    const shape = (g: GuideContent) => ({
      topics: g.topics.map((x) => x.id),
      articles: g.articles.map((a) => ({
        slug: a.slug,
        topic: a.topic,
        when: a.when ?? null,
        intro: Boolean(a.intro),
        steps: a.steps?.length ?? 0,
        notes: a.notes?.length ?? 0,
        link: a.link?.href ?? null,
      })),
    });
    expect(shape(guideEn)).toEqual(shape(guideIt));
  });
});

describe("visibleGuide", () => {
  it("matches every listed condition", () => {
    expect(isVisible(undefined, wallet)).toBe(true);
    expect(isVisible({ mode: "wallet", bankTransfer: true }, wallet)).toBe(true);
    expect(isVisible({ mode: "wallet", bankTransfer: true }, { ...wallet, bankTransfer: false })).toBe(false);
  });

  it("shows the wallet cards to a wallet group and the card payment ones to a pay-per-order group", () => {
    const w = slugs(visibleGuide(guideIt, wallet));
    const p = slugs(visibleGuide(guideIt, perOrder));
    expect(w).toContain("come-funziona-saldo");
    expect(w).not.toContain("da-saldare");
    expect(p).toContain("da-saldare");
    expect(p).not.toContain("saldo-negativo");
    // Each mode explains how to order exactly once.
    expect(w.filter((s) => s.startsWith("fare-ordine"))).toEqual(["fare-ordine"]);
    expect(p.filter((s) => s.startsWith("fare-ordine"))).toEqual(["fare-ordine-carta"]);
  });

  it("drops the family topic when families are off", () => {
    expect(visibleGuide(guideIt, wallet).topics.map((x) => x.id)).not.toContain("famiglia");
    expect(visibleGuide(guideIt, perOrder).topics.map((x) => x.id)).toContain("famiglia");
  });

  it("always tells a wallet group how to top up, whatever channels are on", () => {
    for (const onlineTopup of [true, false]) {
      for (const bankTransfer of [true, false]) {
        const s = slugs(visibleGuide(guideIt, { ...wallet, onlineTopup, bankTransfer }));
        expect(s.filter((x) => x.startsWith("ricarica-")).length).toBeGreaterThan(0);
        expect(s.includes("ricarica-online")).toBe(onlineTopup);
        expect(s.includes("ricarica-bonifico")).toBe(bankTransfer);
        expect(s.includes("ricarica-cassa")).toBe(!onlineTopup && !bankTransfer);
      }
    }
  });
});

describe("searchGuide", () => {
  it("ignores case, accents and bold marks", () => {
    expect(normalizeText("Com'è **Fatta** l'App")).toBe("com e fatta l app");
    expect(search(guideIt, wallet, "COM'È FATTA")).toContain("com-e-fatta");
  });

  it("finds other endings of a long word", () => {
    expect(search(guideIt, wallet, "come ricarico").slice(0, 3)).toEqual(
      expect.arrayContaining(["ricarica-bonifico", "ricarica-online"]),
    );
  });

  it("finds synonyms", () => {
    expect(search(guideIt, perOrder, "marito")).toContain("cos-e-famiglia");
    expect(search(guideIt, wallet, "bancomat")).toContain("ricarica-online");
    expect(search(guideEn, wallet, "household")).toEqual([]);
    expect(search(guideEn, perOrder, "household")).toContain("cos-e-famiglia");
  });

  it("never returns cards the deploy hides", () => {
    expect(search(guideIt, wallet, "famiglia")).toEqual([]);
    expect(search(guideIt, wallet, "da saldare")).not.toContain("da-saldare");
  });

  it("ranks title hits first and prefers cards matching every word", () => {
    expect(search(guideIt, wallet, "annullare ordine")[0]).toBe("modificare-ordine");
    expect(search(guideIt, wallet, "uscire famiglia")).not.toContain("uscire-famiglia");
    expect(search(guideIt, perOrder, "uscire famiglia")[0]).toBe("uscire-famiglia");
  });

  it("returns nothing for an empty query, stopwords only or an unknown word", () => {
    expect(search(guideIt, wallet, "")).toEqual([]);
    expect(search(guideIt, wallet, "come il")).toEqual([]);
    expect(search(guideIt, wallet, "zzzqx")).toEqual([]);
  });
});

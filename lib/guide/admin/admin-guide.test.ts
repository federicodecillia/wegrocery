import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { guideIt } from "../it";
import { buildSearchIndex, searchGuide, ADMIN_GUIDE_SECTION } from "../search";
import { visibleGuide, type GuideContent, type GuideContext } from "../types";
import { adminGuideEn } from "./en";
import { adminGuideFor } from "./index";
import { adminGuideIt } from "./it";

const ROOT = process.cwd();
const wallet: GuideContext = { mode: "wallet", families: false, onlineTopup: false, bankTransfer: true, cards: false };
const walletCards: GuideContext = { ...wallet, onlineTopup: true, cards: true };
const perOrder: GuideContext = { mode: "per_order", families: true, onlineTopup: true, bankTransfer: false, cards: true };

const slugs = (g: GuideContent) => g.articles.map((a) => a.slug);

describe("admin guide content", () => {
  for (const [name, g] of [["it", adminGuideIt], ["en", adminGuideEn]] as const) {
    it(`${name}: slugs are unique and every card has a known topic`, () => {
      expect(new Set(slugs(g)).size).toBe(g.articles.length);
      const topics = new Set(g.topics.map((x) => x.id));
      expect(g.articles.filter((a) => !topics.has(a.topic)).map((a) => a.slug)).toEqual([]);
    });

    it(`${name}: in-app links point at existing pages`, () => {
      const missing = g.articles
        .flatMap((a) => (a.link ? [a.link.href.split("?")[0]] : []))
        .filter((path) => !existsSync(join(ROOT, "app", path, "page.tsx")));
      expect(missing).toEqual([]);
    });

    it(`${name}: no em dash`, () => {
      expect(JSON.stringify(g)).not.toContain("—");
    });
  }

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
    expect(shape(adminGuideEn)).toEqual(shape(adminGuideIt));
  });

  it("never shares a slug with the member guide (search results are keyed by slug)", () => {
    const member = new Set(slugs(guideIt));
    expect(slugs(adminGuideIt).filter((s) => member.has(s))).toEqual([]);
  });

  it("follows the group's settings like the member guide", () => {
    const w = slugs(visibleGuide(adminGuideIt, wallet));
    const c = slugs(visibleGuide(adminGuideIt, walletCards));
    const p = slugs(visibleGuide(adminGuideIt, perOrder));
    expect(w).toContain("registrare-ricarica");
    expect(w).not.toContain("chiudi-conti");
    expect(w).not.toContain("pagamento-ciclo");
    expect(c).toEqual(expect.arrayContaining(["chiudi-conti", "pagamento-ciclo"]));
    expect(p).toContain("chiudi-conti");
    expect(p).not.toContain("registrare-ricarica");
    expect(p).not.toContain("pagamento-ciclo");
    expect(w).not.toContain("famiglie-admin");
    expect(p).toContain("famiglie-admin");
    // The cycle is the heart of it: always there, whatever the settings.
    for (const ctx of [wallet, walletCards, perOrder]) {
      expect(slugs(visibleGuide(adminGuideIt, ctx))).toEqual(
        expect.arrayContaining(["aprire-ciclo", "chiudere-ciclo", "inviare-distinta", "caricare-distinta"]),
      );
    }
  });
});

describe("adminGuideFor", () => {
  it("hands the guide to an active admin only", () => {
    expect(adminGuideFor({ email: "a@example.org", role: "admin", active: true })).not.toBeNull();
    expect(adminGuideFor({ email: "a@example.org", role: "attivi", active: true })).toBeNull();
    expect(adminGuideFor({ email: "a@example.org", role: "utenti", active: true })).toBeNull();
    expect(adminGuideFor({ email: "a@example.org", role: "admin", active: false })).toBeNull();
    expect(adminGuideFor({ email: "a@example.org", role: "admin" })).toBeNull();
    expect(adminGuideFor(null)).toBeNull();
  });
});

describe("admin search", () => {
  const index = buildSearchIndex(visibleGuide(adminGuideIt, wallet).articles, ADMIN_GUIDE_SECTION);
  const search = (query: string) => searchGuide(index, query, adminGuideIt).map((r) => r.entry);

  it("opens the cards under /guida/admin", () => {
    const first = search("chiudere il ciclo")[0];
    expect(first.slug).toBe("chiudere-ciclo");
    expect(first.href).toBe("/guida/admin/ciclo#chiudere-ciclo");
    expect(first.topic).toBe("admin/ciclo");
  });

  it("finds the hard parts in an admin's own words", () => {
    expect(search("distinta").map((e) => e.slug)).toEqual(expect.arrayContaining(["inviare-distinta", "caricare-distinta"]));
    expect(search("bonifico").map((e) => e.slug)).toContain("registrare-ricarica");
    expect(search("doppione").map((e) => e.slug)).toContain("doppioni");
  });

  it("a member's search index has no admin card", () => {
    const memberIndex = buildSearchIndex(visibleGuide(guideIt, perOrder).articles);
    const admin = new Set(slugs(adminGuideIt));
    expect(memberIndex.filter((e) => admin.has(e.slug) || e.href.startsWith("/guida/admin"))).toEqual([]);
    for (const query of ["chiudere il ciclo", "distinta", "aprire ciclo", "fornitore"]) {
      const hits = searchGuide(memberIndex, query, guideIt).map((r) => r.entry.href);
      expect(hits.filter((href) => href.startsWith("/guida/admin"))).toEqual([]);
    }
  });
});

// The admin guide must never reach a browser that has not passed the role
// check: no client component may import it, directly or through other files.
describe("admin guide stays on the server", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.name === "node_modules" || e.name.startsWith(".")) return [];
      const path = join(dir, e.name);
      return e.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(e.name) ? [path] : [];
    });

  function resolveImport(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
    else if (spec.startsWith(".")) base = join(dirname(from), spec);
    else return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
      if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
    }
    return null;
  }

  function imports(file: string): string[] {
    const source = readFileSync(file, "utf8");
    const specs = [...source.matchAll(/(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(?\s*["']([^"']+)["']/g)].map(
      (m) => m[1] ?? m[2],
    );
    return specs.map((s) => resolveImport(file, s)).filter((f): f is string => f !== null);
  }

  it("no client component reaches lib/guide/admin", () => {
    const adminDir = join(ROOT, "lib", "guide", "admin");
    const clientFiles = ["app", "components", "lib"]
      .flatMap((d) => files(join(ROOT, d)))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clientFiles.length).toBeGreaterThan(10);

    const leaks: string[] = [];
    for (const start of clientFiles) {
      const seen = new Set<string>();
      const queue = [start];
      while (queue.length > 0) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        if (file.startsWith(adminDir)) {
          leaks.push(relative(ROOT, start));
          break;
        }
        queue.push(...imports(file));
      }
    }
    expect(leaks).toEqual([]);
  });
});

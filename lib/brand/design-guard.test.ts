import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { contrastRatio } from "./contrast";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
        ? [join(dir, e.name)]
        : [],
  );
}

const files = ["app", "components"].flatMap(sources);
const libFiles = sources("lib");
const hits = (re: RegExp) =>
  files.flatMap((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}`] : [])),
  );

// Keeps the UI on role tokens (see "Design System" in AGENTS.md): a class
// listed here fails WCAG AA or hard-codes one group's palette.
describe("design guard", () => {
  it("has no palette-named classes", () => {
    expect(hits(/brand-(orange|teal)/)).toEqual([]);
  });

  it("never uses the fill-only grey as text", () => {
    expect(hits(/(?<![\w-])text-neutral(?![\w-])/)).toEqual([]);
  });

  it("uses the Playbook 2.2 token names, not the old WeGrocery ones", () => {
    // Renamed in 2026-10: surface -> card, muted (text) -> muted-foreground,
    // brand-near-black -> foreground, brand-warm-white -> background,
    // brand-gray -> secondary-foreground, brand-gray-light -> neutral,
    // brand-border -> border, brand-frame -> frame, *-soft -> *-bg,
    // on-X -> X-foreground, danger-text -> destructive.
    const old = new RegExp(
      String.raw`(?<![\w-])(?:[\w-]+:)*(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|to|via|outline|divide|decoration|caret|shadow)-` +
        String.raw`(?:brand-[a-z-]+|surface|muted|primary-soft|accent-soft|danger-soft|danger-text|on-(?:primary|accent|danger|warning|inverse))(?![\w-])`,
    );
    const inLib = libFiles.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .flatMap((l, i) => (old.test(l) ? [`${f}:${i + 1}`] : [])),
    );
    expect([...hits(old), ...inLib]).toEqual([]);
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).not.toMatch(/--(?:color-)?(?:brand-|surface|near-blk|warm-wh|gray|on-|danger-text|danger-soft|primary-soft|accent-soft)/);
  });

  it("never puts white text on a brand fill", () => {
    // Variant prefixes (hover:, file:, peer-checked:) count too.
    const fill = String.raw`(?<![\w-])bg-(primary|accent)(?![-/\w])`;
    const white = String.raw`(?<![\w-])text-white(?![-\w])`;
    expect(hits(new RegExp(`${fill}.*${white}|${white}.*${fill}`))).toEqual([]);
  });

  it("never fades a text token: the opacity undoes the computed contrast", () => {
    expect(hits(/text-((primary|accent)-text|muted)\/\d/)).toEqual([]);
  });

  it("never uses a fill colour as text", () => {
    expect(hits(/(?<![\w-])text-(primary|accent)(?![-\w])/)).toEqual([]);
  });

  it("paints surfaces and fills with tokens, never white or black (the dark theme swaps them)", () => {
    // bg-card, bg-inverse + text-inverse-foreground, bg-danger + text-danger-foreground,
    // bg-tint for faint fills. Overlays behind a sheet stay bg-black/30..40.
    expect(hits(/(?<![\w-])(?:[a-z-]+:)*bg-white(?![\w-])/)).toEqual([]);
    expect(hits(/(?<![\w-])(?:[a-z-]+:)*text-white(?![\w-])/)).toEqual([]);
    expect(hits(/(?<![\w-])(?:[a-z-]+:)*bg-foreground(?![\w-])/)).toEqual([]);
    expect(hits(/bg-black\/(\[0\.\d+\]|[0-9]|1[0-5])(?![\w-])/)).toEqual([]);
  });

  it("keeps mono for uppercase labels and code-like values (Playbook 2.1)", () => {
    // Amounts and captions are Inter with tabular-nums. Mono stays for
    // uppercase labels, the one-time code field and values such as an IBAN or
    // an address (break-all).
    const lone = hits(/(?<![\w-])font-mono(?![\w-])/).filter((h) => {
      const [f, n] = h.split(":");
      const line = readFileSync(f, "utf8").split("\n")[Number(n) - 1];
      return !/uppercase|tracking-\[0\.3em\]|break-all|\$\{mono/.test(line);
    });
    expect(lone).toEqual([]);
  });

  it("sizes compact controls with --control-h (40 px, 44 px on touch), not fixed 32 to 40 px (Playbook 2.6)", () => {
    expect(hits(/(?<![\w-])min-h-(8|9|10)(?![\w-])/)).toEqual([]);
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/--control-h: 40px/);
    expect(css).toMatch(/pointer: coarse[\s\S]*--control-h: 44px/);
  });

  it("draws cards with a border and no shadow (Playbook 2.9)", () => {
    expect(hits(/border border-border bg-card (p-[46] )?shadow-sm/)).toEqual([]);
  });

  it("spaces with the Tailwind scale, not hand-written pixels (Playbook 2.1 spacing)", () => {
    // p-4.5 is 18px: same pixels, one scale.
    expect(hits(/(?<![\w-])-?(?:(?:p|m)[xytblr]?|gap(?:-[xy])?|space-[xy])-\[\d+px(?:_\d+px){0,2}\]/)).toEqual([]);
  });

  it("has no text under 12px", () => {
    expect(hits(/text-\[(9|10|11)px\]/)).toEqual([]);
  });

  it("has no hard-coded brand hex", () => {
    expect(hits(/#(a07020|f5a623|f9c8c8)/i)).toEqual([]);
  });

  it("keeps member pages on the radius scale and off hard-coded colours", () => {
    // Member and admin pages use rounded-card, rounded-xl, rounded-lg or
    // rounded-full, and colours from tokens (FlyLabs Playbook 2.2, 2.4).
    expect(hits(/rounded-\[\d+px\]|(bg|text|border)-\[#[0-9a-f]{3,8}\]/i)).toEqual([]);
  });

  it("keeps the fixed colours AA with white text", () => {
    const css = readFileSync("app/globals.css", "utf8");
    for (const name of ["danger", "warning", "inverse"]) {
      const hex = css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`, "i"))?.[1];
      expect(hex, name).toBeDefined();
      expect(contrastRatio(hex!, "#ffffff"), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the warning token, not its hex", () => {
    expect(hits(/#b45309/i)).toEqual([]);
  });

  it("leaves focus to the global outline: no faint rings, no hidden outline", () => {
    expect(hits(/focus(-visible)?:(outline-none|ring-)/)).toEqual([]);
  });

  it("asks through ConfirmDialog, never the browser's window.confirm", () => {
    expect(hits(/window\.confirm\(/)).toEqual([]);
  });

  it("uses no Tailwind palette colours: brand tokens only", () => {
    expect(hits(/\b(bg|text|border|ring)-(red|green|blue|amber|yellow|orange|teal|gray|slate|zinc|emerald|rose|sky|indigo|purple)-\d{2,3}\b/)).toEqual([]);
  });

  it("opens every dialog through Sheet", () => {
    const offenders = files.filter(
      (f) => !f.endsWith("components/ui/sheet.tsx") && !f.endsWith("components/ui/confirm-dialog.tsx") &&
        /fixed inset-0/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("names every button that shows only a glyph (✕, ✎, +...)", () => {
    expect(files.flatMap((f) => glyphOnlyButtons(f, readFileSync(f, "utf8")))).toEqual([]);
  });
});

const GLYPHS = /^[✕✎✏×+−\-⋯…⇅↑↓←→🗑️\s]+$/u;

// A screen reader reads "✕" as "multiplication x": a button whose whole text
// is a glyph needs an aria-label (or an sr-only text, which counts as text).
function glyphOnlyButtons(file: string, src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while ((i = src.indexOf("<button", i)) !== -1) {
    const close = src.indexOf("</button>", i);
    if (close === -1) break;
    // The opening tag ends at the first ">" that is not an arrow's.
    let end = i;
    do end = src.indexOf(">", end + 1);
    while (end !== -1 && src[end - 1] === "=");
    const tag = src.slice(i, end);
    const inner = src
      .slice(end + 1, close)
      .replace(/<span[^>]*sr-only[^>]*>[^<]*<\/span>/g, "sr-only")
      .replace(/<[^>]*>/g, "")
      .replace(/\{["'`]([^"'`]*)["'`]\}/g, "$1");
    if (inner.trim() && GLYPHS.test(inner) && !/aria-label/.test(tag)) {
      out.push(`${file}:${src.slice(0, i).split("\n").length}`);
    }
    i = close;
  }
  return out;
}

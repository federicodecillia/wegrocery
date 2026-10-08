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
    expect(hits(/text-brand-gray-light/)).toEqual([]);
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

  it("has no text under 12px", () => {
    expect(hits(/text-\[(9|10|11)px\]/)).toEqual([]);
  });

  it("has no hard-coded brand hex", () => {
    expect(hits(/#(a07020|f5a623|f9c8c8)/i)).toEqual([]);
  });

  it("keeps member pages on the radius scale and off hard-coded colours", () => {
    // Admin keeps its own until it is migrated; member pages use rounded-card,
    // rounded-xl, rounded-lg or rounded-full, and colours from tokens.
    const member = hits(/rounded-\[\d+px\]|(bg|text|border)-\[#[0-9a-f]{3,8}\]/i).filter((h) => !h.includes("admin"));
    expect(member).toEqual([]);
  });

  it("keeps the fixed colours AA with white text", () => {
    const css = readFileSync("app/globals.css", "utf8");
    for (const name of ["red", "warning", "near-blk"]) {
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

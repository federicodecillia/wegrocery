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

  it("opens new dialogs through Sheet (the listed ones move in the admin lot)", () => {
    const pending = new Set(LEGACY_DIALOGS);
    const offenders = files.filter(
      (f) => !pending.has(f) && !f.endsWith("components/ui/sheet.tsx") && !f.endsWith("components/ui/confirm-dialog.tsx") &&
        /fixed inset-0/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

// Hand-rolled dialogs that predate Sheet. Remove a line when its file moves
// to Sheet; the list only shrinks.
const LEGACY_DIALOGS = [
  "app/ordine/order-sent-dialog.tsx",
  "app/storico/movement-detail.tsx",
  "components/admin/cancel-cycle-dialog.tsx",
  "components/admin/ciclo-forms.tsx",
  "components/admin/closed-cycle-details.tsx",
  "components/admin/edit-closed-order-modal.tsx",
  "components/admin/import-listing-wizard.tsx",
  "components/admin/merge-members-dialog.tsx",
  "components/admin/settle-cycle-dialog.tsx",
  "components/admin/supplier-actions-dialog.tsx",
];

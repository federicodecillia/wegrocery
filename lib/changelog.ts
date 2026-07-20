import { readFile } from "node:fs/promises";
import path from "node:path";

// Lightweight parser for the project's CHANGELOG files. The format is fixed
// enough (Keep a Changelog with our own conventions) that a 50-line custom
// parser is preferable to pulling in a full markdown library just to render
// a static page.

export type ChangelogItem = {
  /** Top-level bullet text, with **bold** segments preserved as inline tokens. */
  text: string;
  /** Sub-bullets ("  - ..." in the markdown), as plain text. */
  subitems: string[];
};

export type ChangelogSection = {
  /** "Added", "Fixed", "Aggiunte", etc. */
  heading: string;
  items: ChangelogItem[];
};

export type ChangelogVersion = {
  /** "1.4.0", "Unreleased", "Non rilasciato", ... */
  version: string;
  /** Raw date string from the heading, or null if absent (Unreleased). */
  date: string | null;
  /** One-line italic summary under the heading, when the release has one. */
  tagline: string | null;
  sections: ChangelogSection[];
};

export type ChangelogLanguage = "it" | "en";

const FILE_BY_LANG: Record<ChangelogLanguage, string> = {
  it: "CHANGELOG.it.md",
  en: "CHANGELOG.md",
};

/** Reads + parses a changelog file. The files live inside the Next.js app
 * root (process.cwd() at runtime), so Vercel includes them in the deploy. */
export async function loadChangelog(
  lang: ChangelogLanguage,
): Promise<ChangelogVersion[]> {
  const filePath = path.join(process.cwd(), FILE_BY_LANG[lang]);
  const raw = await readFile(filePath, "utf8");
  return parseChangelog(raw);
}

/** Pure parser, exposed for testing. */
export function parseChangelog(md: string): ChangelogVersion[] {
  // Split on top-level version headings "## [...]". The first chunk is
  // the preamble (project description, contract, etc.) — we drop it.
  const blocks = md.split(/\n## \[/).slice(1);

  const versions: ChangelogVersion[] = [];
  for (const block of blocks) {
    const newlineIdx = block.indexOf("\n");
    if (newlineIdx === -1) continue;

    const titleLine = block.slice(0, newlineIdx);
    // Match: "1.4.0] — 2026-05-14" or "1.4.0] - 2026-05-14" or "Unreleased]"
    const versionMatch = titleLine.match(/^([^\]]+)\]\s*(?:[—-]\s*(.+))?$/);
    if (!versionMatch) continue;

    const version = versionMatch[1].trim();
    const date = versionMatch[2]?.trim() ?? null;

    // Trim body at the next "---" horizontal rule (which separates versions)
    // or at the link-reference block at the bottom of the file.
    let body = block.slice(newlineIdx + 1);
    const sepIdx = body.search(/\n---\s*\n/);
    if (sepIdx >= 0) body = body.slice(0, sepIdx);

    // Split on "### " section headings. Whatever precedes the first one is
    // the version's preamble, which may carry a one-line italic tagline.
    const parts = body.split(/\n### /);
    const tagline = parseTagline(parts[0]);
    const sectionBlocks = parts.slice(1);
    const sections: ChangelogSection[] = [];
    for (const sb of sectionBlocks) {
      const nl = sb.indexOf("\n");
      if (nl === -1) continue;
      const heading = sb.slice(0, nl).trim();
      const items = parseItems(sb.slice(nl + 1));
      if (items.length > 0) sections.push({ heading, items });
    }

    if (sections.length > 0) {
      versions.push({ version, date, tagline, sections });
    }
  }
  return versions;
}

// A tagline is the first non-empty line under the version heading, wrapped in
// single asterisks or underscores. Anything else there (a note, a link) is not
// a tagline and is left out of the rendered page.
const TAGLINE = /^(?:\*([^*].*[^*])\*|_([^_].*[^_])_)$/;

function parseTagline(preamble: string): string | null {
  for (const line of preamble.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(TAGLINE);
    return match ? (match[1] ?? match[2]).trim() : null;
  }
  return null;
}

// Parses a section body into items + subitems. Bullets are recognised as
// lines starting with "- ", subitems as lines starting with "  - ".
function parseItems(body: string): ChangelogItem[] {
  const lines = body.split("\n");
  const items: ChangelogItem[] = [];
  for (const line of lines) {
    if (line.startsWith("  - ")) {
      // Nested bullet — attach to the most recent top-level item.
      const last = items[items.length - 1];
      if (last) last.subitems.push(line.slice(4).trim());
    } else if (line.startsWith("- ")) {
      items.push({ text: line.slice(2).trim(), subitems: [] });
    }
    // Anything else (blank lines, etc.) is ignored.
  }
  return items;
}

/** Splits a bullet text into alternating plain + bold segments so the UI
 * can render **bold** without a full markdown library. Returns the original
 * string when no bold markers are present. */
export function splitInlineBold(
  text: string,
): Array<{ bold: boolean; value: string }> {
  if (!text.includes("**")) return [{ bold: false, value: text }];
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  // After split: [plain, bold, plain, bold, plain, ...]
  return parts
    .map((value, idx) => ({ bold: idx % 2 === 1, value }))
    .filter((p) => p.value.length > 0);
}

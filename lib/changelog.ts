import { readFile } from "node:fs/promises";
import path from "node:path";

// The in-app changelog (Playbook 4.5 and 4.6): a small parser for the two
// CHANGELOG files (Keep a Changelog with the FlyLabs conventions) and the
// filter that shows people only the changes they can understand, with the
// technical ones behind "Show technical details".
//
// FlyLabs Kit registry module `changelog` 1.0, copied as is; the page body is
// components/changelog-view.tsx.

export type ChangelogLanguage = "it" | "en";

/** Who a bullet is written for. */
export type ChangelogAudience = "user" | "technical";

export type ChangelogItem = {
  /** Top-level bullet text, tag removed, with **bold** kept for the UI. */
  text: string;
  /** Sub-bullets ("  - ..." in the markdown), as plain text. */
  subitems: string[];
  audience: ChangelogAudience;
};

export type ChangelogSection = {
  /** "Added", "Aggiunte", "Fixed", ... */
  heading: string;
  items: ChangelogItem[];
};

export type ChangelogVersion = {
  /** "1.4.0", "Unreleased", "Non rilasciato", ... */
  version: string;
  /** Raw date from the heading, or null when absent (Unreleased). */
  date: string | null;
  /** One-line italic summary under the heading, when the release has one. */
  tagline: string | null;
  sections: ChangelogSection[];
};

export const CHANGELOG_FILES: Record<ChangelogLanguage, string> = {
  it: "CHANGELOG.it.md",
  en: "CHANGELOG.md",
};

// A bullet that opens with one of these tags is technical: it matters to
// whoever hosts, runs or develops the app, not to the people using it.
// "[tecnico]" in CHANGELOG.it.md, "[tech]" in CHANGELOG.md; either works in
// both files. An untagged bullet is for users, so changelogs written before
// the tag existed keep showing everything until their technical bullets are
// tagged.
const TECH_TAG = /^\[(?:tecnico|tech|technical)\]\s*/i;

/** Reads and parses a changelog file from the app root (process.cwd() at
 * runtime). On Vercel, list both files in `outputFileTracingIncludes` for the
 * /changelog route in next.config.ts, or the deploy leaves them out. */
export async function loadChangelog(lang: ChangelogLanguage): Promise<ChangelogVersion[]> {
  const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), CHANGELOG_FILES[lang]);
  return parseChangelog(await readFile(filePath, "utf8"));
}

/** Pure parser, exposed for testing. */
export function parseChangelog(md: string): ChangelogVersion[] {
  // Version headings are "## [...]"; the first chunk is the file's preamble.
  const blocks = `\n${md.replace(/\r\n/g, "\n")}`.split(/\n## \[/).slice(1);

  const versions: ChangelogVersion[] = [];
  for (const block of blocks) {
    const newlineIdx = block.indexOf("\n");
    const titleLine = newlineIdx === -1 ? block : block.slice(0, newlineIdx);
    // "1.4.0] - 2026-05-14", the same with an en or em dash, or "Unreleased]".
    const versionMatch = titleLine.match(/^([^\]]+)\]\s*(?:[-\u2013\u2014]\s*(.+))?$/);
    if (!versionMatch || newlineIdx === -1) continue;

    const version = versionMatch[1].trim();
    const date = versionMatch[2]?.trim() || null;

    // The body ends at the "---" rule between versions, if there is one.
    let body = block.slice(newlineIdx + 1);
    const sepIdx = body.search(/(?:^|\n)---\s*(?:\n|$)/);
    if (sepIdx >= 0) body = body.slice(0, sepIdx);

    // Whatever precedes the first "### " section may carry the tagline.
    const parts = body.split(/(?:^|\n)### /);
    const tagline = parseTagline(parts[0]);
    const sections: ChangelogSection[] = [];
    for (const sb of parts.slice(1)) {
      const nl = sb.indexOf("\n");
      if (nl === -1) continue;
      const items = parseItems(sb.slice(nl + 1));
      if (items.length > 0) sections.push({ heading: sb.slice(0, nl).trim(), items });
    }

    if (sections.length > 0) versions.push({ version, date, tagline, sections });
  }
  return versions;
}

// The first non-empty line under the version heading, in single asterisks or
// underscores. Anything else there (a note, a link) is not a tagline.
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

// Bullets are lines starting with "- ", sub-bullets lines starting with "  - ".
function parseItems(body: string): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  for (const line of body.split("\n")) {
    if (line.startsWith("  - ")) {
      items.at(-1)?.subitems.push(line.slice(4).trim());
    } else if (line.startsWith("- ")) {
      const raw = line.slice(2).trim();
      const technical = TECH_TAG.test(raw);
      items.push({
        text: technical ? raw.replace(TECH_TAG, "") : raw,
        subitems: [],
        audience: technical ? "technical" : "user",
      });
    }
  }
  return items;
}

export type VisibleVersion = ChangelogVersion & {
  /** Technical bullets left out of this version by the filter. */
  hiddenTechnical: number;
};

/** What the page shows. Without technical details, technical bullets and the
 * sections they leave empty drop out; a version keeps its heading and
 * tagline even when everything in it is technical, so the release history
 * has no holes and hiddenTechnical says what is behind the switch. */
export function visibleChangelog(versions: ChangelogVersion[], showTechnical: boolean): VisibleVersion[] {
  return versions.map((v) => {
    if (showTechnical) return { ...v, hiddenTechnical: 0 };
    let hiddenTechnical = 0;
    const sections: ChangelogSection[] = [];
    for (const s of v.sections) {
      const items = s.items.filter((item) => item.audience === "user");
      hiddenTechnical += s.items.length - items.length;
      if (items.length > 0) sections.push({ ...s, items });
    }
    return { ...v, sections, hiddenTechnical };
  });
}

/** The value of the page's `?tech=` search param, as the switch writes it. */
export function readShowTechnical(param: string | string[] | undefined): boolean {
  return param === "1";
}

/** Splits a bullet into plain and **bold** segments, so the UI renders bold
 * without a markdown library. */
export function splitInlineBold(text: string): Array<{ bold: boolean; value: string }> {
  if (!text.includes("**")) return [{ bold: false, value: text }];
  return text
    .split(/\*\*([^*]+)\*\*/g)
    .map((value, idx) => ({ bold: idx % 2 === 1, value }))
    .filter((p) => p.value.length > 0);
}

/** The shape both files must share (Playbook 4.5): same versions, dates,
 * sections, bullets and the same audience for each bullet. Only the words
 * and the way dates are written change. The test compares it between
 * CHANGELOG.md and CHANGELOG.it.md. */
export function changelogShape(versions: ChangelogVersion[]): string[] {
  return versions.map((v) => {
    const sections = v.sections.map((s) => s.items.map((i) => (i.audience === "technical" ? "T" : "U")).join(""));
    // "Unreleased" and "Non rilasciato" are the same version with no date.
    return `${v.date ? v.version : "unreleased"} ${sections.join("|")}`;
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHANGELOG_FILES,
  changelogShape,
  parseChangelog,
  readShowTechnical,
  splitInlineBold,
  visibleChangelog,
} from "./changelog";

const SAMPLE = `# Changelog

Preamble that must be dropped.

---

## [Unreleased]

### Added
- New thing
  - detail one
- [tech] Hidden by default

---

## [1.2.0] - 2026-05-14

*A one-line summary of the release.*

### Added
- \u{1F319} **Dark theme.** In Profile, App.
- [TECNICO] \u{1F510} **Restricted database role.** \`scripts/create-app-role.mjs\` creates it.

### Fixed
- [technical] Sentry reads the DSN from the Vercel integration

### Empty section

---

## [1.1.0] \u2014 2026-04-01

### Changed
- [tech] Dependencies updated
`;

describe("parseChangelog", () => {
  const versions = parseChangelog(SAMPLE);

  it("reads versions, dates and taglines, and drops the preamble", () => {
    expect(versions.map((v) => [v.version, v.date])).toEqual([
      ["Unreleased", null],
      ["1.2.0", "2026-05-14"],
      ["1.1.0", "2026-04-01"],
    ]);
    expect(versions[1].tagline).toBe("A one-line summary of the release.");
    expect(versions[0].tagline).toBeNull();
  });

  it("keeps sub-bullets and drops empty sections", () => {
    expect(versions[0].sections[0].items[0].subitems).toEqual(["detail one"]);
    expect(versions[1].sections.map((s) => s.heading)).toEqual(["Added", "Fixed"]);
  });

  it("marks tagged bullets as technical, in either language and any case, and strips the tag", () => {
    const added = versions[1].sections[0].items;
    expect(added.map((i) => i.audience)).toEqual(["user", "technical"]);
    expect(added[1].text).toBe("\u{1F510} **Restricted database role.** `scripts/create-app-role.mjs` creates it.");
    expect(versions[1].sections[1].items[0].audience).toBe("technical");
  });

  it("treats an untagged bullet as written for users", () => {
    expect(parseChangelog("## [1.0.0] - 2026-01-01\n\n### Added\n- Something\n")[0].sections[0].items[0].audience).toBe("user");
  });
});

describe("visibleChangelog", () => {
  const versions = parseChangelog(SAMPLE);

  it("shows everything with technical details on", () => {
    const all = visibleChangelog(versions, true);
    expect(all[1].sections).toEqual(versions[1].sections);
    expect(all.every((v) => v.hiddenTechnical === 0)).toBe(true);
  });

  it("hides technical bullets and the sections they leave empty, and counts them", () => {
    const [unreleased, v120, v110] = visibleChangelog(versions, false);
    expect(unreleased.sections[0].items.map((i) => i.text)).toEqual(["New thing"]);
    expect(unreleased.hiddenTechnical).toBe(1);
    expect(v120.sections.map((s) => s.heading)).toEqual(["Added"]);
    expect(v120.hiddenTechnical).toBe(2);
    // A fully technical release keeps its place in the history.
    expect(v110.sections).toEqual([]);
    expect(v110.hiddenTechnical).toBe(1);
  });
});

describe("readShowTechnical", () => {
  it("is off unless the switch set it", () => {
    expect(readShowTechnical(undefined)).toBe(false);
    expect(readShowTechnical("0")).toBe(false);
    expect(readShowTechnical(["1", "1"])).toBe(false);
    expect(readShowTechnical("1")).toBe(true);
  });
});

describe("splitInlineBold", () => {
  it("splits plain and bold segments", () => {
    expect(splitInlineBold("**Bold** fix")).toEqual([
      { bold: true, value: "Bold" },
      { bold: false, value: " fix" },
    ]);
    expect(splitInlineBold("plain")).toEqual([{ bold: false, value: "plain" }]);
  });
});

// The app's own files: the two changelogs must keep the same shape, technical
// tags included (Playbook 4.5). ROOT is the app root, one folder above lib/.
const ROOT = join(import.meta.dirname, "..");

describe("the app's changelogs", () => {
  it("have the same versions, sections, bullets and audiences in both languages", () => {
    const read = (file: string) => parseChangelog(readFileSync(join(ROOT, file), "utf8"));
    expect(changelogShape(read(CHANGELOG_FILES.it))).toEqual(changelogShape(read(CHANGELOG_FILES.en)));
  });
});

// WeGrocery's own cases, kept from its parser's earlier tests.
describe("parseChangelog edge cases", () => {
  it("does not mistake a bold line for a tagline", () => {
    const md = "# Changelog\n\n## [3.0.0] - 2026-02-01\n\n**Not a tagline.**\n\n### Added\n\n- Thing\n";
    expect(parseChangelog(md)[0].tagline).toBeNull();
  });

  it("drops versions without any populated section", () => {
    expect(parseChangelog("## [2.0.0] - 2026-01-01\n\nJust prose, no sections.\n")).toEqual([]);
  });

  it("returns an empty list on empty or heading-less input", () => {
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("# Only a title\n\nSome text.")).toEqual([]);
  });

  it("handles several bold runs and drops empty segments", () => {
    expect(splitInlineBold("**a** and **b**")).toEqual([
      { bold: true, value: "a" },
      { bold: false, value: " and " },
      { bold: true, value: "b" },
    ]);
  });
});

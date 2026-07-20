import { describe, expect, it } from "vitest";
import { parseChangelog, splitInlineBold } from "./changelog";

const SAMPLE = `# Changelog

Project preamble that must be dropped.

## [Unreleased]

### Added

- New thing
  - detail one
  - detail two
- Another thing

---

## [1.2.0] — 2026-05-14

*A one-line summary of the release.*

### Fixed

- **Bold** fix here

### Sezione vuota

---

## [1.1.0] - 2026-04-01

### Changed

- Hyphen-dated entry
`;

describe("parseChangelog", () => {
  const versions = parseChangelog(SAMPLE);

  it("drops the preamble and parses every version block", () => {
    expect(versions.map((v) => v.version)).toEqual(["Unreleased", "1.2.0", "1.1.0"]);
  });

  it("parses the date with em-dash or hyphen, null when absent", () => {
    expect(versions[0].date).toBeNull();
    expect(versions[1].date).toBe("2026-05-14");
    expect(versions[2].date).toBe("2026-04-01");
  });

  it("attaches nested bullets to the preceding top-level item", () => {
    const added = versions[0].sections[0];
    expect(added.heading).toBe("Added");
    expect(added.items).toHaveLength(2);
    expect(added.items[0].text).toBe("New thing");
    expect(added.items[0].subitems).toEqual(["detail one", "detail two"]);
    expect(added.items[1].subitems).toEqual([]);
  });

  it("reads the italic tagline under the heading, null when absent", () => {
    expect(versions[1].tagline).toBe("A one-line summary of the release.");
    expect(versions[0].tagline).toBeNull();
  });

  it("does not mistake a bold line for a tagline", () => {
    const md = "# Changelog\n\n## [3.0.0] — 2026-02-01\n\n**Not a tagline.**\n\n### Added\n\n- Thing\n";
    expect(parseChangelog(md)[0].tagline).toBeNull();
  });

  it("drops sections without items", () => {
    expect(versions[1].sections.map((s) => s.heading)).toEqual(["Fixed"]);
  });

  it("drops versions without any populated section", () => {
    const md = "## [2.0.0] — 2026-01-01\n\nJust prose, no sections.\n";
    expect(parseChangelog(md)).toEqual([]);
  });

  it("returns an empty list on empty or heading-less input", () => {
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("# Only a title\n\nSome text.")).toEqual([]);
  });
});

describe("splitInlineBold", () => {
  it("passes plain text through untouched", () => {
    expect(splitInlineBold("no markers here")).toEqual([
      { bold: false, value: "no markers here" },
    ]);
  });

  it("splits bold and plain segments in order", () => {
    expect(splitInlineBold("**Bold** fix here")).toEqual([
      { bold: true, value: "Bold" },
      { bold: false, value: " fix here" },
    ]);
  });

  it("handles multiple bold runs and drops empty segments", () => {
    expect(splitInlineBold("**a** and **b**")).toEqual([
      { bold: true, value: "a" },
      { bold: false, value: " and " },
      { bold: true, value: "b" },
    ]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// FlyLabs Playbook 3.4: no em dash in member-facing text. The language packs
// are read as source, so function strings (email subjects, import warnings)
// are covered too. A dash that stands for an empty value is a plain "-".
const EM_DASH = "—";

describe("language packs", () => {
  for (const file of ["it.ts", "en.ts"]) {
    it(`${file} has no em dash`, () => {
      const lines = readFileSync(join(__dirname, file), "utf8").split("\n");
      const hits = lines.flatMap((l, i) => (l.includes(EM_DASH) ? [`${file}:${i + 1}`] : []));
      expect(hits).toEqual([]);
    });
  }
});

// The changelogs are shown in the app (/changelog). Every version heading and
// everything above the first released version (the preamble and the
// unreleased entries) is checked; the bullets of past releases stay as they
// were published.
describe("changelogs", () => {
  for (const file of ["CHANGELOG.md", "CHANGELOG.it.md"]) {
    it(`${file} has no em dash in headings or new entries`, () => {
      const lines = readFileSync(join(__dirname, "..", "..", file), "utf8").split("\n");
      const firstRelease = lines.findIndex((l) => /^## \[\d/.test(l));
      const hits = lines.flatMap((l, i) =>
        l.includes(EM_DASH) && (l.startsWith("## ") || i < firstRelease) ? [`${file}:${i + 1}`] : [],
      );
      expect(firstRelease).toBeGreaterThan(0);
      expect(hits).toEqual([]);
    });
  }
});

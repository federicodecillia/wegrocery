import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// FlyLabs Playbook 3.4: no em dash in member-facing text. The language packs
// are read as source, so function strings (email subjects, import warnings)
// are covered too. A dash that stands for an empty value is a placeholder and
// lives outside these files.
describe("language packs", () => {
  for (const file of ["it.ts", "en.ts"]) {
    it(`${file} has no em dash`, () => {
      const lines = readFileSync(join(__dirname, file), "utf8").split("\n");
      const hits = lines.flatMap((l, i) => (l.includes("—") ? [`${file}:${i + 1}`] : []));
      expect(hits).toEqual([]);
    });
  }
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A "use server" file may export only async functions (and types): a
// constant there breaks the build with "Only async functions are allowed",
// which neither tsc nor the unit tests see.
describe("server action files", () => {
  it("export only async functions and types", () => {
    const dir = path.join(__dirname);
    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const src = readFileSync(path.join(dir, file), "utf8");
      if (!/^["']use server["'];/m.test(src)) continue;
      src.split("\n").forEach((line, i) => {
        if (/^export\s+(const|let|var|class|enum|default|function\b|\{)/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

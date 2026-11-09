import { execFileSync, spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("validates local credential storage using synthetic inputs only", () => {
  expect(() => execFileSync("python3", ["-B", "scripts/recovery-credentials.test.py"], {
    stdio: "pipe", timeout: 10_000,
  })).not.toThrow();
});

it("refuses redirected input without echoing an accidentally supplied secret", () => {
  const result = spawnSync("python3", ["-B", "scripts/recovery-credentials.py", "ep-synthetic-123.c-5.eu-central-1.aws.neon.tech", "neondb", "neondb_owner"], {
    input: "synthetic-secret", encoding: "utf8", timeout: 10_000,
  });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).not.toContain("synthetic-secret");
  expect(result.stderr).toContain("Configurazione interrotta");
});

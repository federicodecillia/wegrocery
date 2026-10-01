import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// The build step that applies migrations. A database URL nothing listens on
// tells "tried to migrate" (fails) from "skipped" (succeeds) without a database.
function build(env: Record<string, string>) {
  return spawnSync(process.execPath, ["scripts/migrate-on-build.mjs"], {
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "production", DATABASE_URL: "postgres://u:p@127.0.0.1:9/none", ...env },
    encoding: "utf8",
  });
}

describe("migrate-on-build", () => {
  it("does nothing without MIGRATE_ON_BUILD", () => {
    expect(build({ VERCEL_ENV: "production" }).status).toBe(0);
  });

  it("migrates on a production build, and a failure stops the build", () => {
    expect(build({ MIGRATE_ON_BUILD: "true", VERCEL_ENV: "production" }).status).not.toBe(0);
  });

  it("skips preview builds: the variable set on every environment migrates production only", () => {
    const r = build({ MIGRATE_ON_BUILD: "true", VERCEL_ENV: "preview" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/preview/);
  });

  it("migrates a build outside Vercel (VERCEL_ENV unset)", () => {
    expect(build({ MIGRATE_ON_BUILD: "true" }).status).not.toBe(0);
  });
});

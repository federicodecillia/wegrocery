import { chmodSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBackup, validateManifest } from "./recovery-backup.mjs";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(dump = "process.stdout.write('fake archive');", encrypt = "process.stdin.pipe(process.stdout);") {
  const dir = mkdtempSync(join(tmpdir(), "recovery-runner-test-"));
  temporaryDirectories.push(dir);
  chmodSync(dir, 0o700);
  const binary = (name: string, body: string) => {
    const path = join(dir, name);
    writeFileSync(path, `#!${process.execPath}\nif (process.argv.includes('--version')) { console.log('pg_dump (PostgreSQL) 18.6'); } else { ${body} }\n`, { mode: 0o700 });
    return path;
  };
  const serviceFile = join(dir, "services.conf");
  const passwordFile = join(dir, "passwords.conf");
  writeFileSync(serviceFile, "", { mode: 0o600 });
  writeFileSync(passwordFile, "", { mode: 0o600 });
  return {
    version: 1, classification: "fake-data", sourceHost: "ep-synthetic-123.eu-central-1.aws.neon.tech",
    database: "neondb", user: "test_owner", service: "example_backup", serviceFile, passwordFile,
    recipient: `age1${"q".repeat(58)}`, outputDirectory: dir,
    pgDump: binary("dump", dump), age: binary("encrypt", encrypt),
  };
}

describe("bounded recovery backup", () => {
  it("defaults to offline planning without invoking tools or creating an archive", async () => {
    const manifest = fixture("process.exit(41)");
    const before = readdirSync(manifest.outputDirectory);
    expect(await runBackup(manifest)).toEqual({ status: "planned", databaseContacted: false });
    expect(readdirSync(manifest.outputDirectory)).toEqual(before);
  });

  it("rejects unknown keys, connection URLs, pooled endpoints and unclassified data", () => {
    const manifest = fixture();
    for (const invalid of [
      { ...manifest, password: "synthetic-secret" },
      { ...manifest, sourceHost: "postgresql://synthetic-secret@invalid" },
      { ...manifest, sourceHost: "ep-synthetic-123-pooler.eu-central-1.aws.neon.tech" },
      { ...manifest, classification: "customer" },
      { ...manifest, service: "a host=other" },
      { ...manifest, serviceFile: "/tmp/.env.local" },
    ]) expect(() => validateManifest(invalid)).toThrow("Invalid recovery manifest");
  });

  it("refuses credential files with group access before any process runs", async () => {
    const manifest = fixture();
    chmodSync(manifest.passwordFile, 0o640);
    await expect(runBackup(manifest, { execute: true })).rejects.toThrow("Unsafe local configuration");
  });

  it("publishes only a completed archive with private permissions and a checksum", async () => {
    const manifest = fixture();
    const result = await runBackup(manifest, { execute: true });
    expect(result.status).toBe("encrypted");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    const names = readdirSync(manifest.outputDirectory).filter((name) => name.endsWith(".age"));
    expect(names).toHaveLength(1);
    expect(readFileSync(join(manifest.outputDirectory, names[0]), "utf8")).toBe("fake archive");
    expect(statSync(join(manifest.outputDirectory, names[0])).mode & 0o777).toBe(0o600);
    // Fake encryptor tests plumbing only; real encryption is tested separately with age.
  });

  it.each([
    ["process.stderr.write('synthetic-secret'); process.stdout.write('partial'); process.exitCode = 7;", "process.stdin.pipe(process.stdout);"],
    ["process.stdout.write('archive');", "process.stderr.write('synthetic-secret'); process.exit(8);"],
  ])("never publishes partial output or propagates raw process errors", async (dump, encrypt) => {
    const manifest = fixture(dump, encrypt);
    await expect(runBackup(manifest, { execute: true })).rejects.toThrow(/^Backup failed; no completed archive published$/);
    expect(readdirSync(manifest.outputDirectory).some((name) => /\.(age|partial)$/.test(name))).toBe(false);
  });

  it("pins connection identity and excludes ambient credentials from the child", async () => {
    const manifest = fixture(`
      const connection = process.argv[process.argv.indexOf('--dbname') + 1];
      if (!connection.includes('host=ep-synthetic-123.eu-central-1.aws.neon.tech') ||
          !connection.includes("hostaddr='' port=5432") || !connection.includes('sslmode=verify-full') ||
          !connection.includes('default_transaction_read_only=on') || process.env.DATABASE_URL ||
          process.env.PGPASSWORD || process.env.PGOPTIONS) process.exit(4);
      process.stdout.write('archive');
    `);
    const original = process.env.PGPASSWORD;
    process.env.PGPASSWORD = "synthetic-secret";
    try { expect((await runBackup(manifest, { execute: true })).status).toBe("encrypted"); }
    finally {
      if (original === undefined) delete process.env.PGPASSWORD;
      else process.env.PGPASSWORD = original;
    }
  });

  it("fails closed even when a tool exits successfully with a warning", async () => {
    const manifest = fixture("process.stdout.write('archive'); process.stderr.write('warning with synthetic-secret');");
    await expect(runBackup(manifest, { execute: true })).rejects.toThrow("Backup failed");
    expect(readdirSync(manifest.outputDirectory).some((name) => name.endsWith('.age'))).toBe(false);
  });

  it("rejects a PostgreSQL client of another major before exporting", async () => {
    const manifest = fixture();
    writeFileSync(manifest.pgDump, readFileSync(manifest.pgDump, "utf8").replace("18.6", "17.6"));
    await expect(runBackup(manifest, { execute: true })).rejects.toThrow("PostgreSQL 18 pg_dump required");
  });

  it("bounds a stalled pipeline", async () => {
    const manifest = fixture("setInterval(() => {}, 1000);");
    await expect(runBackup(manifest, { execute: true, timeoutMs: 150 })).rejects.toThrow("Backup failed");
  });
});

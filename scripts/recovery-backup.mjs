/** Local, opt-in encrypted export only. No restore, provisioning or transfer commands. */
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, createReadStream, createWriteStream, linkSync, lstatSync, openSync, fsyncSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repository = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const fields = ["version", "classification", "sourceHost", "database", "user", "service", "serviceFile", "passwordFile", "recipient", "outputDirectory", "pgDump", "age"];
const invalid = () => { throw new Error("Invalid recovery manifest"); };

function absoluteLocalPath(value) {
  return typeof value === "string" && isAbsolute(value) && !value.split(sep).some((part) => part.startsWith(".env")) && !/[\r\n\0]/.test(value);
}

export function validateManifest(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== "object" ||
      Object.keys(manifest).length !== fields.length || fields.some((key) => !Object.hasOwn(manifest, key))) invalid();
  if (manifest.version !== 1 || manifest.classification !== "fake-data" ||
      typeof manifest.sourceHost !== "string" ||
      !/^ep-[a-z0-9-]+(?:\.c-[0-9]+)?\.eu-central-1\.aws\.neon\.tech$/.test(manifest.sourceHost) ||
      manifest.sourceHost.includes("-pooler.") ||
      !/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(manifest.recipient)) invalid();
  for (const key of ["database", "user", "service"]) {
    if (typeof manifest[key] !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(manifest[key])) invalid();
  }
  for (const key of ["serviceFile", "passwordFile", "outputDirectory", "pgDump", "age"]) {
    if (!absoluteLocalPath(manifest[key])) invalid();
  }
  return manifest;
}

function outsideRepository(path) {
  const rel = relative(repository, realpathSync(path));
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) throw new Error("Unsafe local configuration");
}

export function privatePath(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0 ||
      (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error("Unsafe local configuration");
  outsideRepository(path);
}

export function childEnvironment(manifest) {
  // Do not inherit DATABASE_URL, PGPASSWORD, PGOPTIONS or other ambient credentials/settings.
  return {
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    PGSERVICEFILE: manifest.serviceFile, PGPASSFILE: manifest.passwordFile,
    LANG: "C", LC_ALL: "C",
  };
}

/** The caller must separately obtain approval for this exact host and backup operation. */
export async function runBackup(input, { execute = false, timeoutMs = 1_200_000, signal } = {}) {
  const manifest = validateManifest(input);
  if (!execute) return { status: "planned", databaseContacted: false };
  try {
    privatePath(manifest.serviceFile);
    privatePath(manifest.passwordFile);
    privatePath(manifest.outputDirectory, true);
    for (const tool of [manifest.pgDump, manifest.age]) {
      const stat = lstatSync(tool);
      if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error();
      // Homebrew executables may be symlinks; reject writable-by-others resolved binaries.
      if ((lstatSync(realpathSync(tool)).mode & 0o022) !== 0) throw new Error();
    }
  } catch { throw new Error("Unsafe local configuration"); }
  const env = childEnvironment(manifest);
  try {
    const version = execFileSync(manifest.pgDump, ["--version"], {
      env, encoding: "utf8", timeout: 5000, maxBuffer: 1024, stdio: ["ignore", "pipe", "ignore"],
    });
    if (!/^pg_dump \(PostgreSQL\) 18\./.test(version.trim())) throw new Error();
  } catch { throw new Error("PostgreSQL 18 pg_dump required"); }

  const name = `recovery-${randomUUID()}.dump.age`;
  const finalPath = join(manifest.outputDirectory, name);
  const partialPath = `${finalPath}.partial`;
  const children = [];
  const controller = new AbortController();
  const stop = () => {
    controller.abort();
    for (const child of children) child.kill("SIGKILL");
  };
  const timer = setTimeout(stop, timeoutMs);
  signal?.addEventListener("abort", stop, { once: true });
  let fd;
  let published = false;
  try {
    if (signal?.aborted) throw new Error();
    fd = openSync(partialPath, "wx", 0o600);
    // Explicit parameters override service entries, including transport and read-only settings.
    // Clear hostaddr so a service cannot silently direct the connection to another IP.
    const connection = `service=${manifest.service} host=${manifest.sourceHost} hostaddr='' port=5432 dbname=${manifest.database} user=${manifest.user} sslmode=verify-full connect_timeout=10 options='-c default_transaction_read_only=on -c statement_timeout=600000'`;
    const launch = (command, args) => {
      const child = spawn(command, args, { env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
      children.push(child);
      let stderrBytes = 0;
      child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; });
      const done = new Promise((resolveDone, rejectDone) => {
        child.on("error", () => rejectDone(new Error("Child failed")));
        child.on("close", (code) => code === 0 && stderrBytes === 0 ? resolveDone(undefined) : rejectDone(new Error("Child failed")));
      });
      // Register a handler immediately, before constructing either pipe.
      done.catch(stop);
      return { child, done };
    };
    const dump = launch(manifest.pgDump, ["--format=custom", "--no-password", "--lock-wait-timeout=5s", "--dbname", connection]);
    dump.child.stdin.end();
    const encryption = launch(manifest.age, ["--encrypt", "--recipient", manifest.recipient]);
    let bytes = 0;
    const limit = new Transform({ transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(bytes > 512 * 1024 * 1024 ? new Error("Size limit") : null, chunk);
    } });
    const output = createWriteStream(partialPath, { fd, autoClose: false });
    const tasks = [dump.done, encryption.done,
      pipeline(dump.child.stdout, encryption.child.stdin, { signal: controller.signal }),
      pipeline(encryption.child.stdout, limit, output, { signal: controller.signal })];
    for (const task of tasks) task.catch(stop);
    const outcomes = await Promise.allSettled(tasks);
    if (controller.signal.aborted || bytes === 0 || outcomes.some((outcome) => outcome.status === "rejected")) throw new Error();
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(partialPath)) hash.update(chunk);
    // link is exclusive: unlike rename, it cannot overwrite an existing final path.
    linkSync(partialPath, finalPath);
    published = true;
    try { unlinkSync(partialPath); } catch { /* A duplicate encrypted link is safe to retain. */ }
    return { status: "encrypted", artifact: name, sha256: hash.digest("hex"), bytes };
  } catch {
    stop();
    throw new Error("Backup failed; no completed archive published");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* An aborted pipeline may already have closed it. */ }
    }
    if (!published) {
      try { unlinkSync(partialPath); } catch { /* Only this run's incomplete artifact. */ }
    }
  }
}

async function main(args) {
  // Do not echo supplied arguments, manifest contents or external errors.
  if (args.length < 1 || args.length > 2 || (args[1] && args[1] !== "--execute-backup") || !absoluteLocalPath(args[0])) {
    throw new Error("Usage: node scripts/recovery-backup.mjs /private/manifest.json [--execute-backup]");
  }
  privatePath(args[0]);
  let manifest;
  try { manifest = JSON.parse(readFileSync(args[0], "utf8")); }
  catch { throw new Error("Invalid recovery manifest"); }
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try { console.log(JSON.stringify(await runBackup(manifest, { execute: args[1] === "--execute-backup", signal: controller.signal }))); }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    console.error("Recovery runner stopped. Check the documented inputs and approval gates; no raw error is logged.");
    process.exitCode = 1;
  });
}

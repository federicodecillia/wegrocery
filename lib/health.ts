// /api/health, the shape every FlyLabs app answers (Playbook 7.1,
// flylabs-kit registry/console): whether the app is up, which release is
// live and whether the database answers. An app may add fields of its own
// (Stellar adds commit); these three are what the Console reads.
export type Health = { ok: boolean; version: string; db: boolean };

// A database that hangs is as down as one that refuses: past the timeout the
// probe counts as failed, so the monitor gets an answer within its own limit.
export const PROBE_TIMEOUT_MS = 3_000;

// version: the app's release (its changelog or package.json), never the
// commit alone.
export async function checkHealth(probe: () => Promise<unknown>, version: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<Health> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health probe timed out")), timeoutMs);
  });
  let db = true;
  try {
    await Promise.race([probe(), timeout]);
  } catch {
    db = false;
  } finally {
    clearTimeout(timer);
  }
  return { ok: db, version, db };
}

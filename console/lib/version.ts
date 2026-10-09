// Semver-ish comparison for the fleet's versions ("1.26.0", "v1.26.0").

export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v?.trim() ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** The newest valid version among the given ones, normalized without "v". */
export function newestVersion(versions: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of versions) {
    const p = parseVersion(v);
    if (!p) continue;
    const norm = p.join(".");
    if (!best || compareVersions(norm, best) > 0) best = norm;
  }
  return best;
}

export function isBehind(version: string | null | undefined, newest: string | null): boolean {
  if (!version || !newest || !parseVersion(version)) return false;
  return compareVersions(version, newest) < 0;
}

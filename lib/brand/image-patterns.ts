/** Allow-list for next/image's remote loader, derived from the brand config.
 *
 * The only remote image the app renders is the brand logo (components/app-shell),
 * and its URL is fixed per deployment by NEXT_PUBLIC_BRAND_JSON. Allowing just
 * that one host keeps /_next/image from doubling as an open image proxy: under a
 * wildcard, anyone can make the deployment fetch arbitrary remote images and run
 * them through sharp, which is the untrusted input the libvips advisories
 * (GHSA-f88m-g3jw-g9cj) and the SVG CPU-exhaustion one (CVE-2026-64644) need in
 * order to be reachable at all.
 *
 * Lives outside lib/brand/parse.ts because next.config.ts loads before the app
 * bundle and can only pull in plain, dependency-free TypeScript.
 */
export type RemotePattern = {
  protocol: "https";
  hostname: string;
  pathname: string;
};

export function brandImagePatterns(rawBrandJson: string | undefined): RemotePattern[] {
  if (!rawBrandJson) return [];

  let logoUrl: unknown;
  try {
    logoUrl = (JSON.parse(rawBrandJson) as Record<string, unknown>)?.logoUrl;
  } catch {
    // A malformed brand config is parseBrandConfig's error to report, with a
    // far better message. Here it only means there is no remote host to allow.
    return [];
  }
  if (typeof logoUrl !== "string") return [];

  let url: URL;
  try {
    url = new URL(logoUrl);
  } catch {
    // Relative logos (the default "/logo.png") are served locally and never
    // reach the remote loader.
    return [];
  }
  // Plain http would let a network attacker swap the logo, and no deployment
  // needs it — the default brand ships the logo inside the app.
  if (url.protocol !== "https:") return [];

  return [{ protocol: "https", hostname: url.hostname, pathname: url.pathname }];
}

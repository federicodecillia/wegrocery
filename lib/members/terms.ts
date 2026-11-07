// Terms and privacy acceptance (drizzle/0051_terms_acceptance.sql): a group
// may ask whoever signs in to accept its privacy notice and terms of service
// before using the app. The texts stay on the group's own site
// (brand.privacyUrl, brand.termsUrl): the app only links them and records who
// accepted which version. Pure: lib/members/terms-gate.ts reads the rows.

export type TermsLinks = { privacyUrl: string | null; termsUrl: string | null };
export type TermsSettings = { termsRequired: boolean; termsVersion: string | null };

/** At least one link to accept: the switch cannot be turned on without. */
export function termsHaveLink(links: TermsLinks): boolean {
  return Boolean(links.privacyUrl || links.termsUrl);
}

/**
 * Whether this person must accept before using the app: the switch is on,
 * a version exists, there is something to read, and the version they
 * accepted (null = never) is not the current one. A group that removes both
 * links stops asking rather than showing an empty box.
 */
export function mustAcceptTerms(settings: TermsSettings, links: TermsLinks, acceptedVersion: string | null): boolean {
  if (!settings.termsRequired || !settings.termsVersion) return false;
  if (!termsHaveLink(links)) return false;
  return acceptedVersion !== settings.termsVersion;
}

/** A new version is the moment an admin asks everyone (again). */
export function newTermsVersion(now: Date): string {
  return now.toISOString();
}

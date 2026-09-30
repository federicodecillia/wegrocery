// An OAuth identity (Google) must come with an address its provider has
// verified, whether or not it belongs to a member: otherwise anyone able to
// make Google report a member's address unverified could sign in as them. The
// email link proves the address by itself.
export function oauthIdentityRefusal(
  user: { emailVerified?: unknown },
  source: { method: string },
): { error: "AccessDenied" } | null {
  if (source.method !== "oauth") return null;
  return user.emailVerified === true ? null : { error: "AccessDenied" };
}

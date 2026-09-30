import type { Admission } from "./admission";

// Which email answers a request for an email link. Everyone gets the same
// screen ("check your inbox"), so the page never tells a member from a
// stranger; the email does, and only to the owner of the address.
export type AuthEmailKind = "login" | "invite" | "notMember" | "accountInactive" | "membershipInactive" | "checkUnavailable";

export function authEmailKind(admission: Admission, invite: boolean): AuthEmailKind {
  if (admission.kind !== "deny") return invite ? "invite" : "login";
  switch (admission.error) {
    case "MembershipInactive":
      return "membershipInactive";
    case "MembershipCheckUnavailable":
      return "checkUnavailable";
    case "NotMember":
      return "notMember";
    default:
      return admission.error === "AccessDenied" ? "accountInactive" : "notMember";
  }
}

// The kinds that carry a sign-in link.
export function carriesLink(kind: AuthEmailKind): boolean {
  return kind === "login" || kind === "invite";
}

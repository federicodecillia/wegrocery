// Member emails and aliases (login keys). No imports: auth.ts, and through it
// the edge middleware, uses this file.

/**
 * The one normalization for a member email or alias, whether it is stored or
 * compared: trimmed and lower-cased. null when blank.
 */
export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export type MemberEmailRow = { memberId: string; fullName: string; email: string; aliasEmail: string | null };

/** A submitted address that another member already holds. */
export type EmailConflict = { address: string; memberId: string; fullName: string };

/**
 * Emails and aliases share one namespace: an address belongs to at most one
 * member, as email or as alias. The unique indexes of migration 0017 cover
 * email vs email and alias vs alias; this also catches the cross pairs.
 * `selfId` is the member being edited, whose own row never conflicts. The
 * email is reported before the alias.
 */
export function findEmailConflict(
  selfId: string | null | undefined,
  wanted: { email: string; aliasEmail: string | null },
  others: readonly MemberEmailRow[],
): EmailConflict | null {
  for (const address of [normalizeEmail(wanted.email), normalizeEmail(wanted.aliasEmail)]) {
    if (!address) continue;
    const holder = others.find(
      (m) =>
        m.memberId !== selfId && (normalizeEmail(m.email) === address || normalizeEmail(m.aliasEmail) === address),
    );
    if (holder) return { address, memberId: holder.memberId, fullName: holder.fullName };
  }
  return null;
}

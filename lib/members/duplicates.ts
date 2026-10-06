// Possible duplicate accounts (Admin -> Members): the same person signed up
// twice, typically because their old address has no membership card and the
// card check let them in with another one, creating a second account. Only a
// suggestion: the admin merges (lib/members/merge.ts) or dismisses the pair,
// never the app on its own (two people can share a name).

export type DuplicateCandidate = {
  memberId: string;
  fullName: string;
  email: string;
  aliasEmail: string | null;
  role: string;
  active: boolean;
  createdAt: Date;
  // Last card check on this account's own addresses ('invalid' = no card).
  membershipStatus: string | null;
  mergedInto: string | null;
};

export type DuplicateReason = "same_name" | "name_in_address";

export type DuplicatePair = {
  // The account the merge dialog proposes to keep: the higher role, then the older.
  survivorId: string;
  absorbedId: string;
  reason: DuplicateReason;
};

const ROLE_RANK: Record<string, number> = { admin: 3, attivi: 2, utenti: 1 };

// Order-free key of a pair, as stored for a dismissed one.
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

// Name words, accents and case ignored: "Marilù  Di Mauro" -> [di, marilu, mauro].
export function nameTokens(fullName: string): string[] {
  return fold(fullName)
    .split(/[^a-z]+/)
    .filter((w) => w.length > 0)
    .sort();
}

// The letters of an address's local part: "Mario.Rossi85@mail.example" -> "mariorossi".
function localLetters(address: string | null): string {
  if (!address) return "";
  return fold(address.split("@")[0] ?? "").replace(/[^a-z]/g, "");
}

// Every word of the name that carries information (3+ letters, at least two
// of them) appears in the address: "Mario Rossi" in mario.rossi85@...
// Short particles (di, de, la) are left out, they match anything.
function nameInAddress(name: string[], address: string | null): boolean {
  const letters = localLetters(address);
  const words = name.filter((w) => w.length >= 3);
  return letters.length > 0 && words.length >= 2 && words.every((w) => letters.includes(w));
}

function matchReason(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateReason | null {
  const na = nameTokens(a.fullName);
  const nb = nameTokens(b.fullName);
  if (na.length >= 2 && na.join(" ") === nb.join(" ")) return "same_name";
  const inB = [b.email, b.aliasEmail].some((x) => nameInAddress(na, x));
  const inA = [a.email, a.aliasEmail].some((x) => nameInAddress(nb, x));
  return inA || inB ? "name_in_address" : null;
}

function keeps(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  const ra = ROLE_RANK[a.role] ?? 0;
  const rb = ROLE_RANK[b.role] ?? 0;
  if (ra !== rb) return ra > rb;
  if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt < b.createdAt;
  return a.memberId < b.memberId;
}

// dismissed: pairs an admin marked "not the same person", as pairKey joined by ":".
export function findDuplicatePairs(
  members: ReadonlyArray<DuplicateCandidate>,
  dismissed: ReadonlySet<string> = new Set(),
): DuplicatePair[] {
  const pool = members.filter((m) => m.active && !m.mergedInto);
  const out: Array<DuplicatePair & { lapsed: boolean; name: string }> = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (dismissed.has(pairKey(a.memberId, b.memberId).join(":"))) continue;
      const reason = matchReason(a, b);
      if (!reason) continue;
      const [survivor, absorbed] = keeps(a, b) ? [a, b] : [b, a];
      out.push({
        survivorId: survivor.memberId,
        absorbedId: absorbed.memberId,
        reason,
        lapsed: survivor.membershipStatus === "invalid",
        name: fold(survivor.fullName),
      });
    }
  }
  // The likeliest first: an account kept out by the card check, then by name.
  out.sort((x, y) => Number(y.lapsed) - Number(x.lapsed) || x.name.localeCompare(y.name));
  return out.map(({ survivorId, absorbedId, reason }) => ({ survivorId, absorbedId, reason }));
}

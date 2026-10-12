// An instance slug names the Vercel project (`wegrocery-<slug>`), the Neon
// project and the shared-domain sender (`<slug>@domain`): lowercase letters,
// digits and single hyphens, 3 to 40 characters, starting with a letter.

export const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;

const RESERVED = new Set(["admin", "api", "console", "www", "demo", "staging", "test", "wegrocery"]);

export function validateSlug(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) {
    return "Lo slug deve avere 3-40 caratteri: lettere minuscole, cifre e trattini singoli, e iniziare con una lettera.";
  }
  if (RESERVED.has(slug)) return "Questo slug è riservato.";
  return null;
}

/** A slug proposal from a group name: "Gas Porta Moneta!" → "gas-porta-moneta". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .replace(/-+$/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function vercelProjectName(slug: string): string {
  return `wegrocery-${slug}`;
}

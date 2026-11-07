// Import members from a CSV (Admin -> Soci -> Importa da file). Pure: the
// file is parsed, its columns recognised by name in four languages, and each
// row gets an outcome against the members already there. The actions in
// lib/actions/admin-members.ts read the members and write the new ones.

import { normalizeEmail } from "@/lib/member-email";
import { nameTokens } from "./duplicates";

export const IMPORT_MAX_ROWS = 2000;
// Invitations per click after an import, under the email provider's daily limit.
export const IMPORT_INVITE_BATCH = 20;
// Under the 1 MB body limit of a server action, with room to spare.
export const IMPORT_MAX_BYTES = 500 * 1024;

export type ImportField = "email" | "fullName" | "firstName" | "lastName" | "aliasEmail" | "role" | "paysOffline";

// Header text folded (accents, case, spaces and punctuation gone) -> field.
// "nome" and "name" are a full name unless a last-name column is there too;
// French "nom" is the last name beside "prénom", else the full name.
const HEADERS: Record<string, ImportField> = {
  email: "email",
  mail: "email",
  indirizzoemail: "email",
  emailaddress: "email",
  correo: "email",
  correoelectronico: "email",
  courriel: "email",
  adresseemail: "email",
  nomeecognome: "fullName",
  nominativo: "fullName",
  nomecompleto: "fullName",
  fullname: "fullName",
  nombrecompleto: "fullName",
  nomcomplet: "fullName",
  nome: "fullName",
  name: "fullName",
  nombre: "fullName",
  nom: "fullName",
  firstname: "firstName",
  prenom: "firstName",
  cognome: "lastName",
  lastname: "lastName",
  surname: "lastName",
  apellido: "lastName",
  apellidos: "lastName",
  nomdefamille: "lastName",
  emailsecondaria: "aliasEmail",
  altraemail: "aliasEmail",
  email2: "aliasEmail",
  secondaryemail: "aliasEmail",
  alias: "aliasEmail",
  correosecundario: "aliasEmail",
  emailsecondaire: "aliasEmail",
  ruolo: "role",
  role: "role",
  rol: "role",
  pagafuoriapp: "paysOffline",
  pagafuoridallapp: "paysOffline",
  paysoffline: "paysOffline",
  paysoutsidetheapp: "paysOffline",
  pagafueradelaapp: "paysOffline",
  paiehorsapp: "paysOffline",
  paiehorsdelapp: "paysOffline",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Splits CSV text into rows of cells: comma, semicolon or tab, quotes with "" inside, BOM and CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = [";", "\t", ","].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ColumnMap = Partial<Record<ImportField, number>>;

/** Which column holds which field, and the headers not recognised. */
export function mapColumns(header: readonly string[]): { columns: ColumnMap; ignored: string[] } {
  const folded = header.map(fold);
  const hasLast = folded.some((h) => HEADERS[h] === "lastName" && h !== "nom");
  const hasPrenom = folded.includes("prenom");
  const columns: ColumnMap = {};
  const ignored: string[] = [];
  folded.forEach((h, i) => {
    let field = HEADERS[h];
    if (h === "nom" && hasPrenom) field = "lastName";
    else if ((h === "nome" || h === "name" || h === "nombre") && hasLast) field = "firstName";
    if (!field || columns[field] !== undefined) {
      if (header[i].trim()) ignored.push(header[i].trim());
      return;
    }
    columns[field] = i;
  });
  return { columns, ignored };
}

const YES = new Set(["si", "sì", "yes", "y", "x", "1", "true", "vero", "oui", "s"]);
const ROLE_WORDS: Record<string, "utenti" | "attivi" | "admin"> = {
  utenti: "utenti",
  utente: "utenti",
  user: "utenti",
  users: "utenti",
  usuario: "utenti",
  usuarios: "utenti",
  utilisateur: "utenti",
  utilisateurs: "utenti",
  attivi: "attivi",
  attivo: "attivi",
  active: "attivi",
  activos: "attivi",
  activo: "attivi",
  actifs: "attivi",
  actif: "attivi",
  admin: "admin",
  amministratore: "admin",
  administrator: "admin",
  administrador: "admin",
  administrateur: "admin",
};

export type ImportOutcome =
  | "new"
  // Same name as a member already there: imported, but worth a look.
  | "possible_duplicate"
  | "existing"
  | "duplicate_in_file"
  | "invalid_email"
  | "missing_email"
  | "conflict";

export type ImportRow = {
  /** The line in the file, counting the header as 1. */
  line: number;
  email: string;
  fullName: string;
  aliasEmail: string | null;
  role: "utenti" | "attivi";
  paysOffline: boolean;
  outcome: ImportOutcome;
  /** An admin role in the file: imported as the base role, an admin names admins by hand. */
  adminRoleDropped: boolean;
};

export type ExistingMember = { email: string; aliasEmail: string | null; fullName: string };

export type ImportPlan =
  | { ok: false; error: "empty" | "no_email_column" | "too_many_rows" }
  | { ok: true; rows: ImportRow[]; ignoredColumns: string[]; counts: Record<ImportOutcome, number> };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * The outcome of every row against the members already there: emails and
 * aliases share one namespace, compared lower-cased (lib/member-email.ts).
 * Only "new" and "possible_duplicate" rows are created.
 */
export function planImport(text: string, existing: readonly ExistingMember[]): ImportPlan {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, error: "empty" };
  if (table.length - 1 > IMPORT_MAX_ROWS) return { ok: false, error: "too_many_rows" };
  const { columns, ignored } = mapColumns(table[0]);
  if (columns.email === undefined) return { ok: false, error: "no_email_column" };

  const owners = new Set<string>();
  for (const m of existing) {
    const a = normalizeEmail(m.email);
    const b = normalizeEmail(m.aliasEmail);
    if (a) owners.add(a);
    if (b) owners.add(b);
  }
  const knownNames = new Set(existing.map((m) => nameTokens(m.fullName).join(" ")).filter(Boolean));
  const seen = new Set<string>();
  const cell = (r: string[], f: ImportField) => (columns[f] === undefined ? "" : (r[columns[f]!] ?? "").trim());

  const rows: ImportRow[] = table.slice(1).map((r, i) => {
    const email = normalizeEmail(cell(r, "email")) ?? "";
    const alias = normalizeEmail(cell(r, "aliasEmail"));
    const joined = [cell(r, "firstName"), cell(r, "lastName")].filter(Boolean).join(" ");
    const fullName = cleanName(cell(r, "fullName") || joined) || email.split("@")[0] || "";
    const roleWord = ROLE_WORDS[fold(cell(r, "role"))];
    const role = roleWord === "attivi" ? "attivi" : "utenti";
    const paysOffline = YES.has(cell(r, "paysOffline").toLowerCase());
    let outcome: ImportOutcome;
    if (!email) outcome = "missing_email";
    else if (!EMAIL_SHAPE.test(email) || (alias !== null && (!EMAIL_SHAPE.test(alias) || alias === email))) outcome = "invalid_email";
    else if (seen.has(email) || (alias !== null && seen.has(alias))) outcome = "duplicate_in_file";
    else if (owners.has(email)) outcome = "existing";
    else if (alias !== null && owners.has(alias)) outcome = "conflict";
    else outcome = knownNames.has(nameTokens(fullName).join(" ")) ? "possible_duplicate" : "new";
    if (email) seen.add(email);
    if (alias) seen.add(alias);
    return {
      line: i + 2,
      email,
      fullName,
      aliasEmail: alias,
      role,
      paysOffline,
      outcome,
      adminRoleDropped: roleWord === "admin",
    };
  });

  const counts = {
    new: 0,
    possible_duplicate: 0,
    existing: 0,
    duplicate_in_file: 0,
    invalid_email: 0,
    missing_email: 0,
    conflict: 0,
  } satisfies Record<ImportOutcome, number>;
  for (const row of rows) counts[row.outcome]++;
  return { ok: true, rows, ignoredColumns: ignored, counts };
}

export function isImportable(row: ImportRow): boolean {
  return row.outcome === "new" || row.outcome === "possible_duplicate";
}

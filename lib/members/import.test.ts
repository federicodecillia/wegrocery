import { describe, expect, it } from "vitest";
import { mapColumns, parseCsv, planImport } from "./import";

describe("parseCsv", () => {
  it("reads comma, semicolon and tab files, with a BOM and CRLF", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps separators, quotes and line breaks inside quotes, and skips empty lines", () => {
    expect(parseCsv('n;e\n"Rossi; Anna";"a""b"\n\n"x\ny";z')).toEqual([
      ["n", "e"],
      ["Rossi; Anna", 'a"b'],
      ["x\ny", "z"],
    ]);
  });
});

describe("mapColumns", () => {
  it("recognises the headers in four languages and lists the others", () => {
    expect(mapColumns(["E-mail", "Nome e cognome", "Telefono"])).toEqual({ columns: { email: 0, fullName: 1 }, ignored: ["Telefono"] });
    expect(mapColumns(["Correo electrónico", "Nombre", "Apellidos"]).columns).toEqual({ email: 0, firstName: 1, lastName: 2 });
    expect(mapColumns(["Courriel", "Prénom", "Nom", "Rôle"]).columns).toEqual({ email: 0, firstName: 1, lastName: 2, role: 3 });
    expect(mapColumns(["Email", "Name", "Secondary email", "Pays offline"]).columns).toEqual({
      email: 0,
      fullName: 1,
      aliasEmail: 2,
      paysOffline: 3,
    });
    expect(mapColumns(["Nom", "Email"]).columns).toEqual({ fullName: 0, email: 1 });
  });
});

describe("planImport", () => {
  const existing = [
    { email: "anna@example.org", aliasEmail: "anna.alt@example.org", fullName: "Anna Verdi" },
    { email: "bruno@example.org", aliasEmail: null, fullName: "Bruno Neri" },
  ];

  it("gives every row its outcome", () => {
    const plan = planImport(
      [
        "Email;Nome;Cognome;Email secondaria;Ruolo;Paga fuori app",
        "nuovo@example.org;Carla;Bianchi;;Attivi;sì",
        "ANNA@example.org;Anna;Verdi;;;",
        "anna.alt@example.org;Anna;V;;;",
        "nuovo@example.org;Carla;B;;;",
        "non-valida;X;Y;;;",
        ";Senza;Email;;;",
        "dario@example.org;Dario;Rossi;bruno@example.org;;",
        "verdi@example.org;Verdi;Anna;;admin;",
      ].join("\n"),
      existing,
    );
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.rows.map((r) => r.outcome)).toEqual([
      "new",
      "existing",
      "existing",
      "duplicate_in_file",
      "invalid_email",
      "missing_email",
      "conflict",
      "possible_duplicate",
    ]);
    expect(plan.rows[0]).toMatchObject({ line: 2, email: "nuovo@example.org", fullName: "Carla Bianchi", role: "attivi", paysOffline: true });
    expect(plan.rows[7]).toMatchObject({ role: "utenti", adminRoleDropped: true });
    expect(plan.counts.new).toBe(1);
    expect(plan.counts.existing).toBe(2);
  });

  it("refuses a file without an email column, without rows or too long", () => {
    expect(planImport("Nome\nAnna", [])).toEqual({ ok: false, error: "no_email_column" });
    expect(planImport("Email\n", [])).toEqual({ ok: false, error: "empty" });
    const long = ["Email", ...Array.from({ length: 2001 }, (_, i) => `m${i}@example.org`)].join("\n");
    expect(planImport(long, [])).toEqual({ ok: false, error: "too_many_rows" });
  });

  it("names a row after its address when the file has no name", () => {
    const plan = planImport("email\nzoe@example.org", []);
    expect(plan.ok && plan.rows[0].fullName).toBe("zoe");
  });
});

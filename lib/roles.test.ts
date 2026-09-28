import { describe, expect, it } from "vitest";
import {
  ACCESS_LEVELS,
  ROLES,
  canAccessCycle,
  getAccessLabel,
  getRoleLabel,
  normalizeAccessLevel,
  normalizeRole,
} from "./roles";

describe("normalizeRole", () => {
  it("keeps canonical roles", () => {
    for (const r of ROLES) expect(normalizeRole(r)).toBe(r);
  });

  it("maps pre-0015 values", () => {
    expect(normalizeRole("socio")).toBe("utenti");
    expect(normalizeRole("attivo")).toBe("attivi");
    expect(normalizeRole("member")).toBe("attivi");
  });

  it("tolerates case and whitespace", () => {
    expect(normalizeRole(" Admin ")).toBe("admin");
    expect(normalizeRole("SOCIO")).toBe("utenti");
  });

  it("rejects unknown, empty and missing values", () => {
    for (const v of ["", "superadmin", "soci", "constructor", "__proto__", null, undefined]) {
      expect(normalizeRole(v)).toBeNull();
    }
  });
});

describe("normalizeAccessLevel", () => {
  it("keeps canonical levels", () => {
    for (const l of ACCESS_LEVELS) expect(normalizeAccessLevel(l)).toBe(l);
  });

  it("maps pre-0015 values", () => {
    expect(normalizeAccessLevel("all")).toBe("utenti");
    expect(normalizeAccessLevel("soci")).toBe("attivi");
    expect(normalizeAccessLevel("member")).toBe("attivi");
  });

  it("rejects unknown, empty and missing values", () => {
    for (const v of ["", "tutti", "socio", "hasOwnProperty", null, undefined]) {
      expect(normalizeAccessLevel(v)).toBeNull();
    }
  });
});

describe("canAccessCycle", () => {
  // Full matrix, canonical values: role -> access levels it may see.
  const matrix: Record<string, Record<string, boolean>> = {
    admin: { utenti: true, attivi: true, admin: true },
    attivi: { utenti: true, attivi: true, admin: false },
    utenti: { utenti: true, attivi: false, admin: false },
  };

  for (const [role, row] of Object.entries(matrix)) {
    for (const [level, expected] of Object.entries(row)) {
      it(`${role} ${expected ? "can" : "cannot"} access a '${level}' cycle`, () => {
        expect(canAccessCycle(level, role)).toBe(expected);
      });
    }
  }

  // Legacy values on either side resolve through the same matrix.
  const legacyRoles: [string, string][] = [
    ["socio", "utenti"],
    ["attivo", "attivi"],
    ["member", "attivi"],
  ];
  const legacyLevels: [string, string][] = [
    ["all", "utenti"],
    ["soci", "attivi"],
    ["member", "attivi"],
  ];

  it("applies the matrix to legacy roles", () => {
    for (const [legacy, role] of legacyRoles) {
      for (const level of ACCESS_LEVELS) {
        expect(canAccessCycle(level, legacy)).toBe(matrix[role][level]);
      }
    }
  });

  it("applies the matrix to legacy access levels", () => {
    for (const role of ROLES) {
      for (const [legacy, level] of legacyLevels) {
        expect(canAccessCycle(legacy, role)).toBe(matrix[role][level]);
      }
    }
  });

  it("keeps the ex-'Utente' role out of ex-'Soci Attivi' cycles (the pre-0015 bug)", () => {
    expect(canAccessCycle("soci", "socio")).toBe(false);
    expect(canAccessCycle("attivi", "socio")).toBe(false);
    expect(canAccessCycle("soci", "attivo")).toBe(true);
  });

  it("denies a missing or unknown role, even on an open cycle", () => {
    for (const role of [null, undefined, "", "guest"]) {
      expect(canAccessCycle("utenti", role)).toBe(false);
    }
  });

  it("lets only admins into a cycle with an unknown access level", () => {
    expect(canAccessCycle("qualcosa_di_strano", "admin")).toBe(true);
    expect(canAccessCycle("qualcosa_di_strano", "attivi")).toBe(false);
    expect(canAccessCycle("qualcosa_di_strano", "utenti")).toBe(false);
  });
});

describe("labels", () => {
  it("labels canonical and legacy values, and echoes unknown ones", () => {
    expect(getRoleLabel("socio")).toBe(getRoleLabel("utenti"));
    expect(getRoleLabel("attivo")).toBe(getRoleLabel("attivi"));
    expect(getRoleLabel("guest")).toBe("guest");
    expect(getAccessLabel("soci")).toBe(getAccessLabel("attivi"));
    expect(getAccessLabel("all")).toBe(getAccessLabel("utenti"));
    expect(getAccessLabel("strano")).toBe("strano");
  });
});

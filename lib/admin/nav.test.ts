import { describe, expect, it } from "vitest";
import { adminHref, adminTitle, resolveAdminRoute } from "./nav";

describe("resolveAdminRoute", () => {
  it("defaults to the cycle, its view left to the workspace", () => {
    expect(resolveAdminRoute(undefined, undefined)).toEqual({ section: "ciclo", view: null });
    expect(resolveAdminRoute("nonsense", "x")).toEqual({ section: "ciclo", view: null });
    expect(resolveAdminRoute("ciclo", "conti")).toEqual({ section: "ciclo", view: "conti" });
  });

  it("keeps the old tabs working", () => {
    expect(resolveAdminRoute("ordini", undefined)).toEqual({ section: "ciclo", view: "ordini" });
    expect(resolveAdminRoute("prodotti", undefined)).toEqual({ section: "catalogo", view: "prodotti" });
    expect(resolveAdminRoute("fornitori", undefined)).toEqual({ section: "catalogo", view: "fornitori" });
    expect(resolveAdminRoute("cassa", undefined)).toEqual({ section: "cassa", view: null });
    expect(resolveAdminRoute("impostazioni", undefined)).toEqual({ section: "impostazioni", view: null });
  });

  it("sends a member's order history to their page in Soci", () => {
    expect(resolveAdminRoute("ordini", undefined, "mem_1")).toEqual({ section: "soci", view: null });
    expect(resolveAdminRoute("ciclo", "ordini", "mem_1")).toEqual({ section: "soci", view: null });
    // With a cycle, or anywhere else, the member parameter changes nothing.
    expect(resolveAdminRoute("ciclo", "ordini", "mem_1", "cyc_1")).toEqual({ section: "ciclo", view: "ordini" });
    expect(resolveAdminRoute("cassa", undefined, "mem_1")).toEqual({ section: "cassa", view: null });
    expect(adminTitle("ordini", undefined, "mem_1")).toBe("Members");
  });

  it("reads the view of a section, falling back to its first", () => {
    expect(resolveAdminRoute("catalogo", "fornitori")).toEqual({ section: "catalogo", view: "fornitori" });
    expect(resolveAdminRoute("catalogo", "ordini")).toEqual({ section: "catalogo", view: "prodotti" });
    expect(resolveAdminRoute("soci", "ordini")).toEqual({ section: "soci", view: null });
  });
});

describe("adminHref and adminTitle", () => {
  it("omits the default view and keeps extra parameters", () => {
    expect(adminHref("ciclo", "panoramica")).toBe("/admin?tab=ciclo");
    expect(adminHref("ciclo", "ordini", { member: "mem_1" })).toBe("/admin?tab=ciclo&view=ordini&member=mem_1");
  });

  it("names the section and a non-default view", () => {
    expect(adminTitle(undefined, undefined)).toBe("Cycle");
    expect(adminTitle("ordini", undefined)).toBe("Cycle: Orders");
    expect(adminTitle("statistiche", undefined)).toBe("Statistics");
  });
});

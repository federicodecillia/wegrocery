import { describe, expect, it } from "vitest";
import { registryErrors, type RegistryInput } from "./registry";

const good: RegistryInput = {
  name: "GAS Riva",
  slug: "riva",
  adminEmail: "anna@riva.it",
  locale: "it",
  currency: "EUR",
  timeZone: "Europe/Rome",
  hostingModel: "managed",
  vercelTeamId: null,
  vercelTeamSlug: null,
  neonOrgId: null,
  requestId: null,
};

describe("registryErrors", () => {
  it("accepts a managed instance without ids", () => {
    expect(registryErrors(good)).toEqual([]);
  });
  it("requires the group's team and org for a group-owned instance", () => {
    expect(registryErrors({ ...good, hostingModel: "group_owned" })).toHaveLength(1);
    expect(registryErrors({ ...good, hostingModel: "group_owned", vercelTeamId: "team_abc", neonOrgId: "org-abc-123" })).toEqual([]);
  });
  it("flags each bad field", () => {
    const errors = registryErrors({ ...good, name: "", slug: "X", adminEmail: "no", currency: "eu", timeZone: "Nowhere", vercelTeamId: "bad id!" });
    expect(errors).toHaveLength(6);
  });
});

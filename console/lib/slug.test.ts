import { describe, expect, it } from "vitest";
import { slugify, validateSlug, vercelProjectName } from "./slug";

describe("validateSlug", () => {
  it("accepts good slugs", () => {
    for (const s of ["portamoneta", "gas-riva", "g42", "abc"]) expect(validateSlug(s)).toBeNull();
  });
  it("refuses bad ones", () => {
    for (const s of ["ab", "Gas", "1gas", "gas-", "-gas", "gas--riva", "gas_riva", "a".repeat(41), "gàs"]) {
      expect(validateSlug(s)).not.toBeNull();
    }
  });
  it("refuses reserved names", () => {
    expect(validateSlug("admin")).not.toBeNull();
  });
});

describe("slugify", () => {
  it("proposes a slug from a name", () => {
    expect(slugify("GAS Porta Moneta!")).toBe("gas-porta-moneta");
    expect(slugify("Città Solidale")).toBe("citta-solidale");
    expect(slugify("  42 Gruppo  ")).toBe("gruppo");
  });
  it("names the Vercel project", () => {
    expect(vercelProjectName("riva")).toBe("wegrocery-riva");
  });
});

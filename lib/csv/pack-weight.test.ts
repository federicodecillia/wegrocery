import { describe, expect, it } from "vitest";
import { packWeightKg, parsePackWeightKg, resolvePricePerKg } from "./pack-weight";

describe("parsePackWeightKg", () => {
  it.each([
    ["Cedri Origine Italia Cat. II - cestello da 6 kg", 6],
    ["Arance Navel Calibro 6/7 cestello da 12kg", 12],
    ["Cachi mela Origine Italia Cat II  Cestello 4KG", 4],
    ["Acciughe salate - 500g", 0.5],
    ["Confettura di FRAGOLE vaso da 240 gr", 0.24],
    ["Carrube naturali - 1,5 kg", 1.5],
    ["Farina - 1.000 g", 1],
    ["Mandorla Pizzuta sgusciata  - 1kg", 1],
    ["12 X Marmellata di Arance Amare - 240 g", 2.88],
    ["Box miele millefiori -12 x 500 g", 6],
    ["Passata 6x700g", 4.2],
    ["Pacco 1 kg (1kg)", 1],
  ])("reads %s", (text, kg) => {
    expect(parsePackWeightKg(text)).toBeCloseTo(kg, 6);
  });

  it.each([
    ["Avocado"],
    ["Bouquet erbe aromatiche"],
    ["OH Liquore Cacao - 17 vol bottiglia da 50 cl"],
    ["Kiwi giallo Cat. II 85-100g - cestello da 6 kg"],
    ["Zucchina verde 18-22 cm"],
    ["2 x 3 x 100 g"],
    ["Olio 1 l e 500 g"],
    [""],
  ])("gives up on %s", (text) => {
    expect(parsePackWeightKg(text)).toBeNull();
  });

  it("prefers the format over the name", () => {
    expect(packWeightKg("cestello 5 kg", "Mele 6 kg")).toBe(5);
    expect(packWeightKg("cestello", "Mele 6 kg")).toBe(6);
    expect(packWeightKg(null, "Mele")).toBeNull();
  });
});

describe("resolvePricePerKg", () => {
  const base = {
    unitPrice: 25.52,
    format: null,
    name: "Cedri - cestello da 6 kg",
    computeWhenMissing: false,
    replaceSuspect: false,
  };

  it("keeps a plausible value from the file", () => {
    expect(resolvePricePerKg({ ...base, filePricePerKg: 4.3 })).toEqual({
      value: 4.3,
      source: "file",
      suspect: false,
    });
  });

  it("flags a value equal to the pack price and replaces it on request", () => {
    expect(resolvePricePerKg({ ...base, filePricePerKg: 25.52 })).toEqual({
      value: 25.52,
      source: "file",
      suspect: true,
    });
    expect(resolvePricePerKg({ ...base, filePricePerKg: 25.52, replaceSuspect: true })).toEqual({
      value: 4.25,
      source: "computed",
      suspect: true,
    });
  });

  it("does not flag a 1 kg pack, where both prices are the same", () => {
    const r = resolvePricePerKg({ ...base, name: "Mandorle - 1 kg", unitPrice: 28.08, filePricePerKg: 28.08 });
    expect(r.suspect).toBe(false);
  });

  it("computes only when asked and when the weight is certain", () => {
    expect(resolvePricePerKg({ ...base, filePricePerKg: null }).source).toBe("none");
    expect(resolvePricePerKg({ ...base, filePricePerKg: null, computeWhenMissing: true })).toEqual({
      value: 4.25,
      source: "computed",
      suspect: false,
    });
    expect(
      resolvePricePerKg({ ...base, name: "Avocado", filePricePerKg: null, computeWhenMissing: true }),
    ).toEqual({ value: null, source: "none", suspect: false });
  });

  it("drops a suspect value it cannot recompute rather than keep it", () => {
    // Suspect needs a known weight, so a replacement always has one: the
    // value is never left equal to the pack price.
    const r = resolvePricePerKg({ ...base, filePricePerKg: 25.52, replaceSuspect: true });
    expect(r.value).not.toBe(25.52);
  });
});

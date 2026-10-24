import { describe, expect, it } from "vitest";
import {
  assignColumn,
  fieldUsingColumn,
  hasSharedColumn,
  isPlausibleHeaderRow,
  suggestMapping,
} from "./header-heuristics";

describe("suggestMapping", () => {
  it("maps a typical supplier header row", () => {
    expect(
      suggestMapping(["Prodotto", "Varietà", "Prezzo unitario", "Categoria", "Note"]),
    ).toEqual({ name: 0, variant: 1, unitPrice: 2, category: 3, notes: 4 });
  });

  it("is case-, whitespace- and accent-insensitive", () => {
    const mapping = suggestMapping(["  DENOMINAZIONE  ", "VARIETA"]);
    expect(mapping.name).toBe(0);
    expect(mapping.variant).toBe(1);
  });

  it("keeps 'Prezzo/kg' distinct from 'Prezzo' even though one contains the other", () => {
    const mapping = suggestMapping(["Prezzo", "Prezzo/kg"]);
    expect(mapping.unitPrice).toBe(0);
    expect(mapping.pricePerKg).toBe(1);
    // Same headers, reversed: mapping must follow the content, not the position.
    const reversed = suggestMapping(["Prezzo/kg", "Prezzo"]);
    expect(reversed.unitPrice).toBe(1);
    expect(reversed.pricePerKg).toBe(0);
  });

  it("never assigns the same column to two fields", () => {
    const mapping = suggestMapping(["Prezzo"]);
    const cols = Object.values(mapping);
    expect(new Set(cols).size).toBe(cols.length);
  });

  it("leaves unmatched fields out instead of guessing", () => {
    expect(suggestMapping(["colonna misteriosa", ""])).toEqual({});
  });
});

describe("isPlausibleHeaderRow", () => {
  it("accepts name + price", () => {
    expect(isPlausibleHeaderRow(["Prodotto", "Prezzo"])).toBe(true);
  });

  it("accepts name + format when there is no price column", () => {
    expect(isPlausibleHeaderRow(["Articolo", "Pezzatura"])).toBe(true);
  });

  it("rejects rows without a name column or without price/format", () => {
    expect(isPlausibleHeaderRow(["Prezzo", "Categoria"])).toBe(false);
    expect(isPlausibleHeaderRow(["Prodotto", "Note"])).toBe(false);
    expect(isPlausibleHeaderRow(["1,50", "Mele Golden", "cassa 10kg"])).toBe(false);
  });
});

describe("assignColumn", () => {
  it("frees the field that held the column", () => {
    const { mapping, freed } = assignColumn({ name: 0, unitPrice: 1 }, "pricePerKg", 1);
    expect(mapping).toEqual({ name: 0, pricePerKg: 1 });
    expect(freed).toBe("unitPrice");
    expect(hasSharedColumn(mapping)).toBe(false);
  });

  it("moves a field without freeing anything when the column is free", () => {
    expect(assignColumn({ name: 0, unitPrice: 1 }, "unitPrice", 2)).toEqual({
      mapping: { name: 0, unitPrice: 2 },
      freed: null,
    });
  });

  it("clears a field", () => {
    expect(assignColumn({ name: 0, unitPrice: 1 }, "unitPrice", undefined).mapping).toEqual({ name: 0 });
  });

  it("spots two fields on one column", () => {
    expect(hasSharedColumn({ unitPrice: 1, pricePerKg: 1 })).toBe(true);
    expect(fieldUsingColumn({ unitPrice: 1 }, 1, "pricePerKg")).toBe("unitPrice");
  });
});

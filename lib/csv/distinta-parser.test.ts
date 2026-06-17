import { describe, it as test, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseCsv, collectViaMeta } from "./distinta-parser";
import { parseOds } from "./ods-reader";

// Only the pure CSV text → grid helper is unit-tested here. The DB-backed
// matching (collectViaCsv / buildPreviewFromRaw) is exercised against a live
// cycle via the in-app diff preview, which the admin always reviews before
// applying.
describe("parseCsv", () => {
  test("comma-delimited rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  test("detects semicolon delimiter and keeps decimal commas intact", () => {
    // Italian LibreOffice export: ';' separator, ',' decimal.
    const grid = parseCsv("Prodotto;Note;Mario\nMele;bio;12,50");
    expect(grid).toEqual([
      ["Prodotto", "Note", "Mario"],
      ["Mele", "bio", "12,50"],
    ]);
  });

  test("respects quoted fields containing the delimiter", () => {
    expect(parseCsv('"a;b";c;d')).toEqual([["a;b", "c", "d"]]);
  });

  test("unescapes doubled quotes inside quoted fields", () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', "x"]]);
  });

  test("handles CRLF line endings and a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("strips a leading BOM", () => {
    expect(parseCsv("﻿a,b")).toEqual([["a", "b"]]);
  });
});

// Integration: the meta-based collector over a real .ods re-save. Builds an
// .ods that mirrors the builder's _meta + Distinta layout (2 products × 2
// members + a shipping row) and asserts the cells/shipping resolve by ID.
// No DB is touched — collectViaMeta only reads sheets.
describe("collectViaMeta over .ods", () => {
  const fcell = (v: number) =>
    `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`;
  const scell = (s: string) =>
    `<table:table-cell office:value-type="string"><text:p>${s}</text:p></table:table-cell>`;
  const ecell = `<table:table-cell/>`;
  const empties = (n: number) => `<table:table-cell table:number-columns-repeated="${n}"/>`;
  const trow = (...cells: string[]) => `<table:table-row>${cells.join("")}</table:table-row>`;
  const blankRows = (n: number) => `<table:table-row table:number-rows-repeated="${n}"/>`;

  function buildOds(): Buffer {
    const meta =
      `<table:table table:name="_meta">` +
      trow(scell("formatVersion"), fcell(1)) +
      trow(scell("cycleId"), scell("cyc_test")) +
      trow(scell("cycleTitle"), scell("Ciclo X")) +
      trow(scell("supplierId"), scell("")) +
      trow(scell("generatedAt"), scell("2026-01-01")) +
      trow(scell("productRowStart"), fcell(5)) +
      trow(scell("productRowEnd"), fcell(6)) +
      trow(scell("shippingRow"), fcell(9)) +
      trow(scell("memberColStart"), fcell(7)) +
      trow(scell("memberColEnd"), fcell(8)) +
      blankRows(1) + // row 11
      trow(scell("kind"), scell("sheetRow"), scell("sheetCol"), scell("id"), scell("label")) + // row 12
      trow(scell("product"), fcell(5), ecell, scell("prd_1"), scell("Mele")) +
      trow(scell("product"), fcell(6), ecell, scell("prd_2"), scell("Pere")) +
      trow(scell("member"), ecell, fcell(7), scell("mem_a"), scell("Alice")) +
      trow(scell("member"), ecell, fcell(8), scell("mem_b"), scell("Bob")) +
      `</table:table>`;
    const distinta =
      `<table:table table:name="Distinta">` +
      blankRows(4) + // rows 1-4 (title/instructions/blank/header)
      trow(empties(6), fcell(1), fcell(2)) + // row 5: Mele → Alice=1, Bob=2
      trow(empties(6), fcell(3), fcell(4)) + // row 6: Pere → Alice=3, Bob=4
      blankRows(2) + // rows 7-8
      trow(empties(6), fcell(0.5), fcell(0.6)) + // row 9: shipping
      `</table:table>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
 <office:body><office:spreadsheet>${meta}${distinta}</office:spreadsheet></office:body>
</office:document-content>`;
    return Buffer.from(zipSync({ "content.xml": strToU8(xml) }));
  }

  test("resolves the matrix and shipping cells by product/member id", () => {
    const c = collectViaMeta(parseOds(buildOds()), "cyc_test");
    expect(c.errors).toEqual([]);
    expect(c.cycleId).toBe("cyc_test");
    expect(new Set(c.cells.map((x) => `${x.productId}/${x.memberId}=${x.raw}`))).toEqual(
      new Set(["prd_1/mem_a=1", "prd_1/mem_b=2", "prd_2/mem_a=3", "prd_2/mem_b=4"]),
    );
    expect(c.shipping.map((s) => `${s.memberId}=${s.raw}`).sort()).toEqual(["mem_a=0.5", "mem_b=0.6"]);
  });

  test("rejects a distinta from a different cycle", () => {
    const c = collectViaMeta(parseOds(buildOds()), "cyc_other");
    expect(c.errors.length).toBeGreaterThan(0);
  });
});

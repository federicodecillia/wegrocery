import { describe, it as test, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseOds } from "./ods-reader";

// Builds a minimal .ods buffer from a content.xml body (the <table:table>
// elements), mirroring what LibreOffice writes when it re-saves our distinta.
function makeOds(tablesXml: string): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
 <office:body><office:spreadsheet>${tablesXml}</office:spreadsheet></office:body>
</office:document-content>`;
  const zipped = zipSync({ "content.xml": strToU8(xml) });
  return Buffer.from(zipped);
}

const floatCell = (v: number) =>
  `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>`;
const stringCell = (s: string) =>
  `<table:table-cell office:value-type="string"><text:p>${s}</text:p></table:table-cell>`;
const emptyCells = (n: number) =>
  `<table:table-cell table:number-columns-repeated="${n}"/>`;

describe("parseOds", () => {
  test("reads float and string cells at 1-based coordinates", () => {
    const wb = makeOds(
      `<table:table table:name="Data"><table:table-row>${floatCell(10)}${stringCell("cyc_abc")}</table:table-row></table:table>`,
    );
    const sheet = parseOds(wb).sheet("Data")!;
    expect(sheet.cell(1, 1)).toBe(10);
    expect(sheet.cell(1, 2)).toBe("cyc_abc");
    expect(sheet.cell(1, 3)).toBeNull();
  });

  test("number-columns-repeated shifts later cells to the correct column", () => {
    // col1=10, col2+col3 empty (repeated), col4=99
    const wb = makeOds(
      `<table:table table:name="Data"><table:table-row>${floatCell(10)}${emptyCells(2)}${floatCell(99)}</table:table-row></table:table>`,
    );
    const sheet = parseOds(wb).sheet("Data")!;
    expect(sheet.cell(1, 1)).toBe(10);
    expect(sheet.cell(1, 2)).toBeNull();
    expect(sheet.cell(1, 3)).toBeNull();
    expect(sheet.cell(1, 4)).toBe(99);
  });

  test("number-rows-repeated shifts later rows to the correct index", () => {
    // row1 has content, rows 2-4 are an empty repeated run, row5 has content
    const wb = makeOds(
      `<table:table table:name="Data">` +
        `<table:table-row>${floatCell(1)}</table:table-row>` +
        `<table:table-row table:number-rows-repeated="3"/>` +
        `<table:table-row>${stringCell("bottom")}</table:table-row>` +
        `</table:table>`,
    );
    const sheet = parseOds(wb).sheet("Data")!;
    expect(sheet.cell(1, 1)).toBe(1);
    expect(sheet.cell(2, 1)).toBeNull();
    expect(sheet.cell(5, 1)).toBe("bottom");
  });

  test("a value-typed cell wins over its displayed text (decimal comma)", () => {
    // LibreOffice shows "12,50" but stores office:value="12.5"
    const wb = makeOds(
      `<table:table table:name="Data"><table:table-row>` +
        `<table:table-cell office:value-type="currency" office:value="12.5"><text:p>12,50</text:p></table:table-cell>` +
        `</table:table-row></table:table>`,
    );
    expect(parseOds(wb).sheet("Data")!.cell(1, 1)).toBe(12.5);
  });

  test("covered (merged) cells keep later value columns aligned", () => {
    // Mirrors the distinta "Spedizione" row: the label spans cols 1-6 (1 real
    // cell + 5 covered), then the first member's value sits at col 7.
    const wb = makeOds(
      `<table:table table:name="Data"><table:table-row>` +
        `<table:table-cell table:number-columns-spanned="6" office:value-type="string"><text:p>Spedizione</text:p></table:table-cell>` +
        `<table:covered-table-cell table:number-columns-repeated="5"/>` +
        floatCell(7.5) +
        `</table:table-row></table:table>`,
    );
    const sheet = parseOds(wb).sheet("Data")!;
    expect(sheet.cell(1, 1)).toBe("Spedizione");
    expect(sheet.cell(1, 7)).toBe(7.5);
  });

  test("unknown sheet name returns undefined", () => {
    const wb = makeOds(`<table:table table:name="Data"><table:table-row>${floatCell(1)}</table:table-row></table:table>`);
    expect(parseOds(wb).sheet("Nope")).toBeUndefined();
  });
});

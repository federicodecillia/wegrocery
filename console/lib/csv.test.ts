import { describe, expect, it } from "vitest";
import { csvField, toCsv } from "./csv";

describe("csvField", () => {
  it("leaves plain values alone", () => {
    expect(csvField("Porta Moneta")).toBe("Porta Moneta");
    expect(csvField(42)).toBe("42");
    expect(csvField(-3)).toBe("-3");
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });
  it("quotes commas, quotes, newlines and semicolons", () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(csvField("a;b")).toBe('"a;b"');
    expect(csvField(" padded ")).toBe('" padded "');
  });
  it("neutralizes formulas in text", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("@SUM")).toBe("'@SUM");
    expect(csvField("-1+2")).toBe("'-1+2");
  });
});

describe("toCsv", () => {
  it("joins with CRLF and ends with one", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

import { describe, expect, it } from "vitest";
import { decodeUploadBase64, MAX_UPLOAD_BYTES } from "./upload-limit";

describe("decodeUploadBase64", () => {
  it("decodes a normal payload", () => {
    const buf = decodeUploadBase64(Buffer.from("hello").toString("base64"));
    expect(buf.toString("utf8")).toBe("hello");
  });

  it("accepts a payload right at the limit", () => {
    const atLimit = Buffer.alloc(MAX_UPLOAD_BYTES).toString("base64");
    expect(decodeUploadBase64(atLimit).length).toBe(MAX_UPLOAD_BYTES);
  });

  it("rejects an oversized payload before decoding it", () => {
    // One byte over the cap. The check must run on the base64 string length,
    // so the oversized blob is never actually allocated as a Buffer.
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 3).toString("base64");
    expect(() => decodeUploadBase64(oversized)).toThrowError(/10\s?MB/);
  });
});

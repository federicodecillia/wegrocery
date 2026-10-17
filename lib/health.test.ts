import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("is ok when the database answers", async () => {
    expect(await checkHealth(() => Promise.resolve([{ "?column?": 1 }]), "1.2.0")).toEqual({ ok: true, version: "1.2.0", db: true });
  });

  it("is not ok when the database refuses, without the error's text", async () => {
    const health = await checkHealth(() => Promise.reject(new Error("password authentication failed")), "1.2.0");
    expect(health).toEqual({ ok: false, version: "1.2.0", db: false });
  });

  it("is not ok when the database hangs past the timeout", async () => {
    expect((await checkHealth(() => new Promise(() => {}), "1.2.0", 20)).db).toBe(false);
  });
});

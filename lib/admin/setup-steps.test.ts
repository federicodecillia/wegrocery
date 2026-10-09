import { describe, expect, it } from "vitest";
import { SETUP_STEPS, setupHref, stepIndex } from "./setup-steps";

describe("setup steps", () => {
  it("starts at the first step for anything unknown", () => {
    expect(stepIndex(undefined)).toBe(0);
    expect(stepIndex("nope")).toBe(0);
    expect(stepIndex("checks")).toBe(SETUP_STEPS.indexOf("checks"));
  });

  it("links a step", () => {
    expect(setupHref("payments")).toBe("/admin/avvio?step=payments");
  });
});

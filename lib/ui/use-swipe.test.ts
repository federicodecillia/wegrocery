import { describe, expect, it } from "vitest";
import { SWIPE_CLOSE_PX, swipeDismisses } from "./use-swipe";

describe("swipeDismisses", () => {
  it("closes on a long drag, however slow", () => {
    expect(swipeDismisses(SWIPE_CLOSE_PX, 2000)).toBe(true);
  });

  it("closes on a short flick but not on a short slow drag", () => {
    expect(swipeDismisses(40, 50)).toBe(true);
    expect(swipeDismisses(40, 400)).toBe(false);
  });

  it("never closes on a tiny or upward move", () => {
    expect(swipeDismisses(10, 5)).toBe(false);
    expect(swipeDismisses(-200, 50)).toBe(false);
  });
});

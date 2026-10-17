import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps the theme's text sizes next to a text colour", () => {
    expect(cn("text-label", "text-accent-text")).toBe("text-label text-accent-text");
    expect(cn("text-title", "text-foreground")).toBe("text-title text-foreground");
  });

  it("still lets a later size win", () => {
    expect(cn("text-label", "text-sm")).toBe("text-sm");
  });
});

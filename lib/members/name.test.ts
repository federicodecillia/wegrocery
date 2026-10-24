import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, isNamePromptMode, joinFullName, nameNeedsCompleting } from "./name";

describe("nameNeedsCompleting", () => {
  it("flags the start of the sign-in address", () => {
    expect(nameNeedsCompleting("mario.rossi", ["mario.rossi@example.org"])).toBe(true);
    expect(nameNeedsCompleting("Mario.Rossi ", ["mario.rossi@example.org"])).toBe(true);
  });

  it("flags the start of the alias too", () => {
    expect(nameNeedsCompleting("mrossi99", ["mario@example.org", "mrossi99@example.com"])).toBe(true);
  });

  it("flags an empty name or an address", () => {
    expect(nameNeedsCompleting("", ["a@example.org"])).toBe(true);
    expect(nameNeedsCompleting(null, ["a@example.org"])).toBe(true);
    expect(nameNeedsCompleting("mario@example.org", ["other@example.org"])).toBe(true);
  });

  it("leaves a name the member or an admin wrote", () => {
    expect(nameNeedsCompleting("Mario Rossi", ["mario.rossi@example.org"])).toBe(false);
    expect(nameNeedsCompleting("Mario", ["mario.rossi@example.org"])).toBe(false);
    expect(nameNeedsCompleting("mario", ["mario.rossi@example.org", null])).toBe(false);
  });

  it("ignores missing addresses", () => {
    expect(nameNeedsCompleting("Anna", [null, undefined, ""])).toBe(false);
  });
});

describe("joinFullName", () => {
  it("joins and tidies first and last name", () => {
    expect(joinFullName("  Maria ", " De  Luca")).toBe("Maria De Luca");
  });

  it("needs both", () => {
    expect(joinFullName("Maria", " ")).toBeNull();
    expect(joinFullName("", "Rossi")).toBeNull();
  });

  it("refuses a name longer than the limit", () => {
    expect(joinFullName("a".repeat(NAME_MAX_LENGTH), "b")).toBeNull();
  });
});

describe("isNamePromptMode", () => {
  it("knows the three modes", () => {
    expect(["off", "optional", "required"].every(isNamePromptMode)).toBe(true);
    expect(isNamePromptMode("always")).toBe(false);
    expect(isNamePromptMode(null)).toBe(false);
  });
});

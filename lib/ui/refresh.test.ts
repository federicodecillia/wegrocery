import { describe, expect, it } from "vitest";
import { REFRESH_AFTER_HIDDEN_MS, refreshAllowed, shouldRefreshOnReturn } from "./refresh";

describe("refresh on return", () => {
  it("refreshes after five minutes away, not before", () => {
    expect(shouldRefreshOnReturn("/", REFRESH_AFTER_HIDDEN_MS)).toBe(true);
    expect(shouldRefreshOnReturn("/", REFRESH_AFTER_HIDDEN_MS - 1)).toBe(false);
  });

  it("never touches the order page", () => {
    expect(refreshAllowed("/ordine")).toBe(false);
    expect(shouldRefreshOnReturn("/ordine", REFRESH_AFTER_HIDDEN_MS * 10)).toBe(false);
    expect(refreshAllowed("/storico")).toBe(true);
    expect(refreshAllowed("/ordinewhatever")).toBe(true);
  });
});

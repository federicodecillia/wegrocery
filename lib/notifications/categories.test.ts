import { describe, it, expect } from "vitest";
import {
  CATEGORY_DEFAULTS,
  NOTIFICATION_CATEGORIES,
  categoryForType,
  channelsForType,
  isNotificationCategory,
  resolvePreferences,
} from "./categories";

describe("CATEGORY_DEFAULTS", () => {
  it("has an entry for every category", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_DEFAULTS[category]).toBeDefined();
    }
  });

  it("enables the in-app channel for every category", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_DEFAULTS[category].app).toBe(true);
    }
  });

  it("enables email by default ONLY for cycle_opened", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_DEFAULTS[category].email).toBe(category === "cycle_opened");
    }
  });
});

describe("categoryForType", () => {
  it("maps legacy DB types to their category", () => {
    expect(categoryForType("order_closed")).toBe("order_charge");
    expect(categoryForType("topup_received")).toBe("wallet_topup");
    expect(categoryForType("order_corrected")).toBe("order_updates");
    expect(categoryForType("order_adjusted")).toBe("order_updates");
  });

  it("maps the new event types to their category", () => {
    expect(categoryForType("cycle_opened")).toBe("cycle_opened");
    expect(categoryForType("cycle_closing_reminder")).toBe("cycle_closing_reminder");
  });

  it("returns null for unknown types", () => {
    expect(categoryForType("shipping_charge")).toBeNull();
    expect(categoryForType("something_new")).toBeNull();
  });
});

describe("isNotificationCategory", () => {
  it("accepts known categories and rejects everything else", () => {
    expect(isNotificationCategory("order_charge")).toBe(true);
    expect(isNotificationCategory("order_closed")).toBe(false); // that's a type, not a category
    expect(isNotificationCategory("")).toBe(false);
  });
});

describe("resolvePreferences", () => {
  it("returns the defaults when there are no stored rows", () => {
    expect(resolvePreferences([])).toEqual(CATEGORY_DEFAULTS);
  });

  it("does not mutate CATEGORY_DEFAULTS", () => {
    const resolved = resolvePreferences([]);
    resolved.order_charge.email = true;
    expect(CATEGORY_DEFAULTS.order_charge.email).toBe(false);
  });

  it("overlays a stored row on top of the defaults", () => {
    const resolved = resolvePreferences([
      { category: "order_charge", appEnabled: false, emailEnabled: true },
    ]);
    expect(resolved.order_charge).toEqual({ app: false, email: true });
    // untouched categories keep their defaults
    expect(resolved.wallet_topup).toEqual({ app: true, email: false });
    expect(resolved.cycle_opened).toEqual({ app: true, email: true });
  });

  it("ignores rows for unknown categories", () => {
    const resolved = resolvePreferences([
      { category: "ghost_category", appEnabled: false, emailEnabled: false },
    ]);
    expect(resolved).toEqual(CATEGORY_DEFAULTS);
  });
});

describe("channelsForType", () => {
  const resolved = resolvePreferences([
    { category: "order_charge", appEnabled: false, emailEnabled: false },
  ]);

  it("resolves a known type through its category preferences", () => {
    expect(channelsForType("order_closed", resolved)).toEqual({ app: false, email: false });
    expect(channelsForType("topup_received", resolved)).toEqual({ app: true, email: false });
  });

  it("delivers unknown types in-app only, never by email", () => {
    expect(channelsForType("shipping_charge", resolved)).toEqual({ app: true, email: false });
  });
});

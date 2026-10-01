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

  it("sends no email by default: members turn email on themselves", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(CATEGORY_DEFAULTS[category].email).toBe(false);
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
    expect(categoryForType("cycle_cancelled")).toBe("order_updates");
  });

  // Manual Cassa movements reuse existing categories, so no new preference
  // toggle appears: a payout is the other side of a top-up, a manual charge
  // or a membership fee is a debit on the balance like an order.
  it("maps the manual Cassa movements to existing categories", () => {
    expect(categoryForType("payout_sent")).toBe("wallet_topup");
    expect(categoryForType("manual_charge_recorded")).toBe("order_charge");
    expect(categoryForType("membership_fee_charged")).toBe("order_charge");
  });

  it("files a failed card refund under top-ups", () => {
    expect(categoryForType("refund_failed")).toBe("wallet_topup");
  });

  it("returns null for unknown types", () => {
    expect(categoryForType("shipping_charge")).toBeNull();
    expect(categoryForType("something_new")).toBeNull();
  });

  // The closing-reminder feature was removed, but notifications sent while it
  // existed are still in members' inboxes. They must keep rendering, which the
  // unknown-type branch guarantees: in-app yes, email never.
  it("treats the retired closing reminder as an unknown type", () => {
    expect(categoryForType("cycle_closing_reminder")).toBeNull();
    expect(isNotificationCategory("cycle_closing_reminder")).toBe(false);
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
    expect(resolved.cycle_opened).toEqual({ app: true, email: false });
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

describe("pay-per-order notification types", () => {
  // Each preference voice must match its hint: everything the member is
  // charged or pays (order paid online, balance paid) sits under
  // "Charges and payments"; only money coming back sits under the wallet.
  it("files payments under order_charge and refunds under the wallet", () => {
    expect(categoryForType("order_paid")).toBe("order_charge");
    expect(categoryForType("balance_paid")).toBe("order_charge");
    expect(categoryForType("settlement_due")).toBe("order_charge");
    expect(categoryForType("order_refund_sent")).toBe("wallet_topup");
  });
});

describe("full type to category map", () => {
  it("pins every known type", () => {
    const expected: Record<string, string> = {
      cycle_opened: "cycle_opened",
      order_closed: "order_charge",
      settlement_due: "order_charge",
      manual_charge_recorded: "order_charge",
      membership_fee_charged: "order_charge",
      order_paid: "order_charge",
      balance_paid: "order_charge",
      order_adjusted: "order_updates",
      order_corrected: "order_updates",
      cycle_cancelled: "order_updates",
      topup_received: "wallet_topup",
      payout_sent: "wallet_topup",
      order_refund_sent: "wallet_topup",
      refund_failed: "wallet_topup",
    };
    for (const [type, category] of Object.entries(expected)) {
      expect(categoryForType(type), type).toBe(category);
    }
  });
});

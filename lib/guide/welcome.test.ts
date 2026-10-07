import { describe, expect, it } from "vitest";
import { guideIt } from "./it";
import { isWelcomeStep, WELCOME_LINKS, welcomeMoney, welcomeSteps } from "./welcome";

const base = { families: false, install: false };

describe("welcome steps", () => {
  it("explains the balance in a wallet group", () => {
    expect(welcomeSteps({ ...base, money: welcomeMoney("wallet", false) })).toEqual([
      "intro",
      "balance",
      "order",
      "pickup",
      "notify",
      "help",
    ]);
    // pays_offline only matters in pay-per-order.
    expect(welcomeMoney("wallet", true)).toBe("wallet");
  });

  it("explains card payment in a pay-per-order group", () => {
    expect(welcomeSteps({ ...base, money: welcomeMoney("per_order", false) })).toContain("pay");
  });

  it("has no money step for a member who pays outside the app", () => {
    const steps = welcomeSteps({ ...base, money: welcomeMoney("per_order", true) });
    expect(steps).not.toContain("balance");
    expect(steps).not.toContain("pay");
  });

  it("adds family and install only when they apply, before the help", () => {
    expect(welcomeSteps({ money: "wallet", families: true, install: true }).slice(-3)).toEqual([
      "family",
      "install",
      "help",
    ]);
  });

  it("recognizes a stored step", () => {
    expect(isWelcomeStep("order")).toBe(true);
    expect(isWelcomeStep("toString")).toBe(false);
    expect(isWelcomeStep(null)).toBe(false);
  });

  it("links guide cards that exist", () => {
    for (const href of Object.values(WELCOME_LINKS)) {
      const match = href.match(/^\/guida\/([^#]+)#(.+)$/);
      if (!match) continue;
      const [, topic, slug] = match;
      expect(guideIt.articles.some((a) => a.topic === topic && a.slug === slug)).toBe(true);
    }
  });
});

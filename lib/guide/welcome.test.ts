import { describe, expect, it } from "vitest";
import { guideIt } from "./it";
import { WELCOME_LINKS, welcomeMoney, welcomeSteps } from "./welcome";

describe("welcome steps", () => {
  it("explains the balance in a wallet group", () => {
    expect(welcomeSteps(welcomeMoney("wallet", false), false)).toEqual(["balance", "order", "help"]);
    // pays_offline only matters in pay-per-order.
    expect(welcomeMoney("wallet", true)).toBe("wallet");
  });

  it("explains card payment in a pay-per-order group", () => {
    expect(welcomeSteps(welcomeMoney("per_order", false), false)).toEqual(["pay", "order", "help"]);
  });

  it("has no money step for a member who pays outside the app", () => {
    expect(welcomeSteps(welcomeMoney("per_order", true), false)).toEqual(["order", "help"]);
  });

  it("adds the install step on a phone, before the help", () => {
    expect(welcomeSteps("wallet", true)).toEqual(["balance", "order", "install", "help"]);
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

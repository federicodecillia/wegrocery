import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BY_FLYLABS_MIN_WIDTH, BY_FLYLABS_RATIO, ByFlylabs, flylabsHref } from "./by-flylabs";
import { BY_FLYLABS_PATHS, BY_FLYLABS_VIEWBOX } from "./by-flylabs-paths";

describe("flylabsHref", () => {
  it("links the product page in the user's language, with no tracking", () => {
    expect(flylabsHref("it", "gpt-chatbot")).toBe("https://www.flylabs.ai/it/gpt-chatbot");
    expect(flylabsHref("en")).toBe("https://www.flylabs.ai/en");
  });
});

describe("ByFlylabs", () => {
  it("draws the wordmark with an accessible name and no hex colours", () => {
    const html = renderToStaticMarkup(<ByFlylabs locale="en" productSlug="stellar-reviews" newTab />);
    expect(html).toContain('href="https://www.flylabs.ai/en/stellar-reviews"');
    expect(html).toContain('aria-label="by flylabs.ai"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("fill-(--flylabs-ai)");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it("falls back to plain text when it would be narrower than the minimum", () => {
    const tiny = Math.floor(BY_FLYLABS_MIN_WIDTH / BY_FLYLABS_RATIO) - 1;
    const html = renderToStaticMarkup(<ByFlylabs locale="it" height={tiny} />);
    expect(html).not.toContain("<svg");
    expect(html).toContain(">by flylabs.ai</a>");
  });

  it("keeps the ratio in step with the generated artwork", () => {
    const [, , w, h] = BY_FLYLABS_VIEWBOX.split(" ").map(Number);
    expect(w / h).toBeCloseTo(BY_FLYLABS_RATIO, 2);
    expect(Object.keys(BY_FLYLABS_PATHS)).toEqual(["by", "flylabs", "dot", "ai"]);
  });
});

// WeGrocery: the logo's colours are FlyLabs' own, the same for every group
// (Playbook 2.11): light in app/globals.css, dark in lib/brand/roles.ts.
describe("the flylabs.ai colours", () => {
  it("are the kit's, in light and dark, whatever the group's palette", async () => {
    const { readFileSync } = await import("node:fs");
    const { deriveDarkRoleVars } = await import("@/lib/brand/roles");
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/--flylabs-ai: #343bec;/);
    expect(css).toMatch(/--flylabs-spark: #d99a00;/);
    for (const theme of [{}, { primary: "#237032", accent: "#1971c2" }]) {
      expect(deriveDarkRoleVars(theme)["--flylabs-ai"]).toBe("#7a80ff");
      expect(deriveDarkRoleVars(theme)["--flylabs-spark"]).toBe("#ffda47");
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, deriveRoleVars } from "@/lib/brand/roles";
import { APP_NAME, EMAIL_THEME, FLYLABS_URL, LOGO_HEIGHT, LOGO_PATH, LOGO_WIDTH, emailHtml, escapeHtml, textToHtml } from "./layout";

const WEB = join(import.meta.dirname, "..", "..");

describe("EMAIL_THEME", () => {
  // WeGrocery's token names (Playbook 2.2 deviation): the fixed colours live in
  // app/globals.css, the brand roles in lib/brand/roles.ts.
  const css = readFileSync(join(WEB, "app", "globals.css"), "utf8");
  const root = css.slice(css.indexOf(":root {"));
  const token = (name: string) => root.match(new RegExp(`--${name}:\\s*([^;]+);`, "i"))?.[1].trim();
  const roles = deriveRoleVars(DEFAULT_PALETTE);

  // An rgba() token drawn over an opaque background, as a mail client paints it.
  function over(rgba: string, background: string): string {
    const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
    const bg = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16));
    return `#${[r, g, b].map((c, i) => Math.round(c * a + bg[i] * (1 - a)).toString(16).padStart(2, "0")).join("")}`;
  }

  it("is the light theme of app/globals.css and the default brand palette", () => {
    expect(EMAIL_THEME).toEqual({
      background: roles["--background"],
      card: token("surface"),
      foreground: token("foreground"),
      mutedForeground: roles["--muted"],
      primaryText: roles["--primary-text"],
      border: over(token("border")!, token("surface")!),
    });
  });

  it("serves the logo from a file that exists, at three times the size shown", () => {
    const png = readFileSync(join(WEB, "public", LOGO_PATH));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([LOGO_WIDTH * 3, LOGO_HEIGHT * 3]);
  });
});

describe("textToHtml", () => {
  it("escapes the text, so a member's words can never become markup", () => {
    expect(escapeHtml(`<b>"Tom" & 'Ann'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Ann&#39;&lt;/b&gt;");
    expect(textToHtml("<script>x</script>")).not.toContain("<script>");
  });

  it("makes paragraphs on blank lines and a line break on a single newline", () => {
    expect(textToHtml("Ciao,\r\nriga due\n\n\nSecondo")).toBe(
      '<p style="margin:0 0 16px 0">Ciao,<br>riga due</p>\n<p style="margin:0">Secondo</p>',
    );
  });

  it("links a URL and leaves the punctuation that closes the sentence outside", () => {
    const html = textToHtml("Apri qui: https://x.example/w/a?next=%2Fvoce&b=1.");
    expect(html).toContain('href="https://x.example/w/a?next=%2Fvoce&amp;b=1"');
    expect(html).toMatch(/<\/a>\.<\/p>$/);
  });
});

describe("emailHtml", () => {
  it("shows the app's logo linked to the app, then By FlyLabs.ai linked to flylabs.ai", () => {
    const html = emailHtml("Testo", { subject: "Oggetto <1>", baseUrl: "https://gas.example.org/" });
    expect(html).toContain('<a href="https://gas.example.org"><img src="https://gas.example.org/mail/logo.png"');
    expect(html).toContain(`alt="${APP_NAME}"`);
    expect(html).toContain(`<a href="${FLYLABS_URL}"`);
    expect(html).toContain("FlyLabs.ai</span></a>");
    expect(html).toContain("<title>Oggetto &lt;1&gt;</title>");
    expect(html.indexOf("Testo")).toBeLessThan(html.indexOf(LOGO_PATH));
  });

  it("writes the name instead of the logo when there is no base URL", () => {
    const html = emailHtml("Testo", { subject: "O", baseUrl: "" });
    expect(html).not.toContain("<img");
    expect(html).toContain(`${APP_NAME}</span>`);
  });
});

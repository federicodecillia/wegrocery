import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { DEFAULT_PALETTE, deriveRoleVars } from "@/lib/brand/roles";
import { APP_NAME, EMAIL_THEME, FLYLABS_URL, LOGO_HEIGHT, LOGO_PATH, LOGO_WIDTH, buttonLabel, emailColors, emailHtml, emailLogoUrl, escapeHtml, textToHtml, type EmailIdentity } from "./layout";

const WEB = join(import.meta.dirname, "..", "..");

describe("EMAIL_THEME", () => {
  // The fixed colours live in app/globals.css, the brand roles in
  // lib/brand/roles.ts (computed per group).
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
      card: token("card"),
      foreground: token("foreground"),
      mutedForeground: roles["--muted-foreground"],
      primary: roles["--primary"],
      primaryForeground: roles["--primary-foreground"],
      primaryText: roles["--primary-text"],
      border: over(token("border")!, token("card")!),
    });
  });

  it("is what emailColors gives for the default palette", () => {
    expect(EMAIL_THEME).toMatchObject(emailColors({}));
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
    const html = textToHtml("Il link è https://x.example/w/a?next=%2Fvoce&b=1.");
    expect(html).toContain('href="https://x.example/w/a?next=%2Fvoce&amp;b=1"');
    expect(html).toMatch(/<\/a>\.<\/p>$/);
  });
});

describe("emailHtml", () => {
  it("shows the app's logo linked to the app, then by flylabs.ai linked to flylabs.ai", () => {
    const html = emailHtml("Testo", { subject: "Oggetto <1>", baseUrl: "https://gas.example.org/" });
    expect(html).toContain('<a href="https://gas.example.org"><img src="https://gas.example.org/mail/logo.png"');
    expect(html).toContain(`alt="${APP_NAME}"`);
    expect(html).toContain(`<a href="${FLYLABS_URL}"`);
    expect(html).toContain('by <span style="text-decoration:underline">flylabs.ai</span></a>');
    expect(html).not.toContain("FlyLabs.ai");
    expect(html).toContain("<title>Oggetto &lt;1&gt;</title>");
    expect(html.indexOf("Testo")).toBeLessThan(html.indexOf(LOGO_PATH));
  });

  it("links flylabs.ai in the emails' language, with no tracking", () => {
    expect(FLYLABS_URL).toMatch(/^https:\/\/www\.flylabs\.ai\/(it|en)(\/[a-z-]+)?$/);
  });

  it("leaves the signature out when the group switched it off, keeping the logo", () => {
    const html = emailHtml("Testo", { subject: "O", baseUrl: "https://gas.example.org", signature: false });
    expect(html).not.toContain("flylabs.ai");
    expect(html).toContain(LOGO_PATH);
  });

  it("writes the name instead of the logo when there is no base URL", () => {
    const html = emailHtml("Testo", { subject: "O", baseUrl: "" });
    expect(html).not.toContain("<img");
    expect(html).toContain(`${APP_NAME}</span>`);
  });
});

const BASE = "https://gas.example.org";
const GREEN: EmailIdentity = {
  name: "GAS Verde",
  logoUrl: `${BASE}/brand/logo-1.png`,
  showName: true,
  colors: emailColors({ primary: "#2e7d32", background: "#f4f8f4" }),
};

describe("the group's look", () => {
  it("puts the group's logo and name on top, in its colours", () => {
    const html = emailHtml("Testo", { subject: "O", baseUrl: BASE, identity: GREEN });
    expect(html).toContain(`<img src="${BASE}/brand/logo-1.png"`);
    expect(html).toContain(">GAS Verde</span>");
    expect(html).toContain("background:#f4f8f4");
    expect(html).toContain("border-top:4px solid #2e7d32");
    expect(html.indexOf("GAS Verde")).toBeLessThan(html.indexOf("Testo"));
  });

  it("leaves the name out next to a wordmark logo, never with no logo", () => {
    const wordmark = emailHtml("T", { subject: "O", baseUrl: BASE, identity: { ...GREEN, showName: false } });
    expect(wordmark).not.toContain(">GAS Verde</span>");
    const none = emailHtml("T", { subject: "O", baseUrl: BASE, identity: { ...GREEN, logoUrl: null, showName: false } });
    expect(none).toContain(">GAS Verde</span>");
  });

  it("makes the logo absolute and drops one a mail client cannot show", () => {
    expect(emailLogoUrl("/brand/logo-1.webp", `${BASE}/`)).toBe(`${BASE}/brand/logo-1.webp`);
    expect(emailLogoUrl("https://cdn.example.org/l.png?v=2", "")).toBe("https://cdn.example.org/l.png?v=2");
    expect(emailLogoUrl("/logo.svg", BASE)).toBeNull();
    expect(emailLogoUrl("/logo.png", "")).toBeNull();
  });

  it("titles the card with the notification", () => {
    expect(emailHtml("T", { subject: "O", baseUrl: BASE, heading: "Ordini <aperti>" })).toContain(">Ordini &lt;aperti&gt;</h1>");
  });
});

describe("buttons, code and the preferences link", () => {
  const render = { baseUrl: BASE, colors: GREEN.colors };

  it("turns a link to the app alone on its line into a button named after the page", () => {
    const html = textToHtml(`Si è aperto.\n\nApri nell'app: ${BASE}/ordine`, render);
    expect(html).toContain(`<a href="${BASE}/ordine"`);
    expect(html).toContain(`>${escapeHtml(t.email.buttons.order)}</a>`);
    expect(html).toContain("background:#2e7d32");
    expect(html).not.toContain("Apri nell&#39;app:");
  });

  it("names the button by page, else by the words before the link", () => {
    const b = t.email.buttons;
    expect(buttonLabel(`${BASE}/storico?cycleId=c1`, BASE, null)).toBe(b.history);
    expect(buttonLabel(`${BASE}/login/conferma?token=x`, BASE, null)).toBe(b.signIn);
    expect(buttonLabel(`${BASE}/admin/cicli/c1`, BASE, null)).toBe(b.admin);
    expect(buttonLabel(`${BASE}/profilo`, BASE, null)).toBe(b.profile);
    expect(buttonLabel(`${BASE}/`, BASE, "Apri nell'app")).toBe(b.app);
    // Another site: the page names mean nothing there.
    expect(buttonLabel("https://altro.example/ordine", BASE, "Rinnova la tessera")).toBe("Rinnova la tessera");
    expect(buttonLabel("https://altro.example/ordine", BASE, null)).toBe(b.link);
  });

  it("keeps a link inside a sentence a link", () => {
    const html = textToHtml(`Puoi rinnovarla qui: ${BASE}/x e poi entra.`, render);
    expect(html).not.toContain("<table");
    expect(html).toContain(`href="${BASE}/x"`);
  });

  it("makes the preferences link small, with its own words", () => {
    const html = textToHtml(`Gestisci le tue preferenze di notifica: ${BASE}/profilo/notifiche`, render);
    expect(html).toContain("font-size:13px");
    expect(html).toContain(">Gestisci le tue preferenze di notifica</a>");
    expect(html).not.toContain("<table");
  });

  it("shows a six-digit code in a large box", () => {
    const html = textToHtml("Oppure scrivi questo codice:\n\n482913", render);
    expect(html).toMatch(/letter-spacing:8px[^>]*>482913<\/div>$/);
  });
});

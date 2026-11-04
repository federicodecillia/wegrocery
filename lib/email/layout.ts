// The HTML part of every app email (Playbook 7.7): the group's logo and name
// on top, the plain text the caller wrote on a card in the group's light
// colours, then the app's logo and "by flylabs.ai" linked to the product page
// on flylabs.ai (Playbook 2.11), unless the group switched the signature off.
// The text part stays as written, for the mail clients that show only that.
//
// The text is read, not rewritten: a link to the app alone on its line
// ("Apri nell'app: https://...") becomes a button named after the page it
// opens, the notification preferences link a small one at the foot, a
// six-digit sign-in code a large box. Everything else is paragraphs.
//
// FlyLabs Kit registry module `email` 1.1 (from Stellar Reviews), with
// WeGrocery's name, logo and light theme, and the signature switch
// (brand.flylabsSignature). lib/email/resend.ts adds it to every message it
// sends.

import { brand } from "@/lib/brand";
import { flylabsProductUrl } from "@/lib/brand/flylabs";
import { deriveRoleVars } from "@/lib/brand/roles";
import type { BrandTheme } from "@/lib/brand/types";
import { t } from "@/lib/i18n";

export const APP_NAME = "WeGrocery";

// WeGrocery's light theme: a mail client reads no stylesheet and no CSS
// variables, so the values are copied here. The token names are the
// Playbook 2.2 ones; the brand roles (background, primary-text,
// muted-foreground) come from
// lib/brand/roles.ts for the default WeGrocery palette, since app/layout.tsx
// sets them per group. border is --border (a translucent grey) over the card.
// lib/email/layout.test.ts checks they match.
export const EMAIL_THEME = {
  background: "#faf8f5",
  card: "#ffffff",
  foreground: "#2d2b29",
  mutedForeground: "#6b6b6b",
  primary: "#f5a623",
  primaryForeground: "#2d2b29",
  primaryText: "#8e6014",
  border: "#eeeeef",
} as const;

/** The colours a group sets (Impostazioni or the brand JSON); card, text and border stay the app's. */
export type EmailColors = Record<"background" | "mutedForeground" | "primary" | "primaryForeground" | "primaryText", string>;

/** The group's light colours, from the same roles the app uses (lib/brand/roles.ts). */
export function emailColors(theme: BrandTheme): EmailColors {
  const v = deriveRoleVars(theme);
  return {
    background: v["--background"],
    mutedForeground: v["--muted-foreground"],
    primary: v["--primary"],
    primaryForeground: v["--primary-foreground"],
    primaryText: v["--primary-text"],
  };
}

/** Who the email comes from: the group's name and logo (absolute URL, or none) and colours. */
export type EmailIdentity = {
  name: string;
  logoUrl: string | null;
  /** The name next to the logo; off when the logo is a wordmark (brand.headerShowName). */
  showName: boolean;
  colors: EmailColors;
};

const DEFAULT_IDENTITY: EmailIdentity = { name: APP_NAME, logoUrl: null, showName: true, colors: EMAIL_THEME };

// SVG does not show in Gmail or Outlook: such a logo leaves the name alone.
const MAIL_IMAGE = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

/** The group's logo as a mail client can fetch it: absolute, and an image type it shows. */
export function emailLogoUrl(logoUrl: string, baseUrl: string): string | null {
  const absolute = /^https?:\/\//i.test(logoUrl) ? logoUrl : baseUrl && logoUrl.startsWith("/") ? `${baseUrl.replace(/\/+$/, "")}${logoUrl}` : null;
  return absolute && MAIL_IMAGE.test(absolute) ? absolute : null;
}

// The product page on flylabs.ai in the emails' language, no tracking; the
// home while WeGrocery has none (lib/brand/flylabs.ts).
export const FLYLABS_URL = flylabsProductUrl(brand.locale);
// Served from public/mail/, which the middleware (or proxy.ts) must leave
// open: a mail client fetches it with no session.
export const LOGO_PATH = "/mail/logo.png";
// A horizontal PNG (SVG does not show in Gmail or Outlook) at three times
// the size shown, for sharp high-DPI screens: WeGrocery's is 492x120, the
// app icon and the name.
export const LOGO_WIDTH = 164;
export const LOGO_HEIGHT = 40;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A URL in the text becomes a link; the punctuation that closes a sentence
// ("...qui: https://x.example/a.") stays outside it.
const URL_RE = /https?:\/\/[^\s<>"]+/g;
const TRAILING = /[.,;:!?)\]]+$/;

function linkify(escaped: string, color: string): string {
  return escaped.replace(URL_RE, (match) => {
    const url = match.replace(TRAILING, "");
    const rest = match.slice(url.length);
    return `<a href="${url}" style="color:${color};text-decoration:underline;word-break:break-all">${url}</a>${rest}`;
  });
}

// The pages a button can open, by the start of their path, most specific first.
const PAGE_LABELS: [string, (b: typeof t.email.buttons) => string][] = [
  ["/login", (b) => b.signIn],
  ["/ordine", (b) => b.order],
  ["/storico", (b) => b.history],
  ["/ricarica", (b) => b.topUp],
  ["/famiglia", (b) => b.family],
  ["/calendario", (b) => b.calendar],
  ["/notifiche", (b) => b.notifications],
  ["/profilo", (b) => b.profile],
  ["/admin", (b) => b.admin],
];

const PREFERENCES_PATH = "/profilo/notifiche";

function pathIn(url: string, baseUrl: string): string | null {
  try {
    const u = new URL(url);
    if (!baseUrl || u.origin !== new URL(baseUrl).origin) return null;
    return u.pathname;
  } catch {
    return null;
  }
}

/** What a button says: the page it opens in the app, else the words before the link, else a plain "open". */
export function buttonLabel(url: string, baseUrl: string, words: string | null): string {
  const b = t.email.buttons;
  const path = pathIn(url, baseUrl);
  if (path !== null) {
    const page = PAGE_LABELS.find(([p]) => path === p || path.startsWith(`${p}/`));
    return page ? page[1](b) : b.app;
  }
  return words || b.link;
}

// A paragraph that is one link and at most a few words before it:
// "https://..." or "Apri nell'app: https://...".
const LINK_LINE = /^(?:([^\n:]{1,60}):\s*)?(https?:\/\/[^\s<>"]+)$/;
const CODE_LINE = /^\d{6}$/;

type Render = { baseUrl: string; colors: EmailColors };

function button(url: string, label: string, c: EmailColors): string {
  // A table cell carries the fill, so Outlook paints it too.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:12px;background:${c.primary}"><a href="${url}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${c.primaryForeground};text-decoration:none;border-radius:12px">${escapeHtml(label)}</a></td></tr></table>`;
}

function paragraph(text: string, margin: string, r: Render): string {
  const c = r.colors;
  if (CODE_LINE.test(text)) {
    return `<div style="margin:${margin};padding:14px 16px;background:${c.background};border:1px solid ${EMAIL_THEME.border};border-radius:12px;text-align:center;font-family:'SF Mono', Menlo, Consolas, monospace;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:${EMAIL_THEME.foreground}">${text}</div>`;
  }
  const link = LINK_LINE.exec(text);
  if (link) {
    const url = link[2].replace(TRAILING, "");
    const words = link[1]?.trim() || null;
    const href = escapeHtml(url);
    if (pathIn(url, r.baseUrl) === PREFERENCES_PATH) {
      return `<p style="margin:${margin};font-size:13px;line-height:20px;color:${c.mutedForeground}"><a href="${href}" style="color:${c.mutedForeground};text-decoration:underline">${escapeHtml(words ?? t.email.buttons.preferences)}</a></p>`;
    }
    return `<div style="margin:${margin}">${button(href, buttonLabel(url, r.baseUrl, words), c)}</div>`;
  }
  const body = text.split("\n").map((line) => linkify(escapeHtml(line), c.primaryText)).join("<br>");
  return `<p style="margin:${margin}">${body}</p>`;
}

// Paragraphs on blank lines, a <br> on a single newline.
export function textToHtml(text: string, render: Partial<Render> = {}): string {
  const r: Render = { baseUrl: (render.baseUrl ?? "").replace(/\/+$/, ""), colors: render.colors ?? EMAIL_THEME };
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p, i, all) => paragraph(p.trim(), i === all.length - 1 ? "0" : "0 0 16px 0", r))
    .join("\n");
}

// The group, above the card: its logo linked to the app, and its name.
function header(baseUrl: string, identity: EmailIdentity): string {
  const name = escapeHtml(identity.name);
  const img = identity.logoUrl
    ? `<img src="${escapeHtml(identity.logoUrl)}" height="40" alt="${name}" style="display:block;border:0;height:40px;width:auto;max-width:200px">`
    : "";
  const text = identity.showName || !img ? `<span style="font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;color:${EMAIL_THEME.foreground}">${name}</span>` : "";
  const cells = [img, text].filter(Boolean).map((cell, i) => `<td style="vertical-align:middle${i > 0 ? ";padding-left:10px" : ""}">${cell}</td>`).join("");
  const row = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
  return `<tr><td style="padding:0 8px 16px 8px">${baseUrl ? `<a href="${baseUrl}" style="text-decoration:none">${row}</a>` : row}</td></tr>`;
}

function footer(baseUrl: string, signature: boolean, colors: EmailColors): string {
  const flylabs = signature
    ? `<div style="padding-top:8px;font-family:${FONT};font-size:13px;line-height:20px"><a href="${FLYLABS_URL}" style="color:${colors.mutedForeground};text-decoration:none">by <span style="text-decoration:underline">flylabs.ai</span></a></div>`
    : "";
  // Without a base URL there is no address for the logo: the name in text.
  const logo = baseUrl
    ? `<a href="${baseUrl}"><img src="${baseUrl}${LOGO_PATH}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${escapeHtml(APP_NAME)}" style="display:block;border:0;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px"></a>`
    : `<span style="font-weight:600;color:${EMAIL_THEME.foreground}">${escapeHtml(APP_NAME)}</span>`;
  return `<tr><td style="padding:24px 8px 0 8px">${logo}${flylabs}</td></tr>`;
}

// `signature`: "by flylabs.ai" under the logo, on unless the group switched
// it off (brand.flylabsSignature). `identity`: the group (resend.ts reads it
// from getBrand); WeGrocery's name and colours when omitted. `heading`: a
// title on top of the card (a notification's).
export function emailHtml(
  text: string,
  opts: { subject: string; baseUrl: string; signature?: boolean; identity?: EmailIdentity; heading?: string | null },
): string {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const identity = opts.identity ?? DEFAULT_IDENTITY;
  const c = identity.colors;
  const heading = opts.heading
    ? `<h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:20px;line-height:28px;font-weight:700;color:${EMAIL_THEME.foreground}">${escapeHtml(opts.heading)}</h1>\n`
    : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.background}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
${header(baseUrl, identity)}
<tr><td style="background:${EMAIL_THEME.card};border:1px solid ${EMAIL_THEME.border};border-top:4px solid ${c.primary};border-radius:16px;padding:28px 24px;font-family:${FONT};font-size:15px;line-height:24px;color:${EMAIL_THEME.foreground}">
${heading}${textToHtml(text, { baseUrl, colors: c })}
</td></tr>
${footer(baseUrl, opts.signature ?? true, c)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

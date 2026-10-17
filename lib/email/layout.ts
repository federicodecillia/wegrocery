// The HTML part of every app email (Playbook 7.7): the plain text the caller
// wrote, on a card in the light colours of the app, then the app's logo and
// "By FlyLabs.ai" linked to flylabs.ai. The text part stays as written, for
// the mail clients that show only that.
//
// FlyLabs Kit registry module `email` 1.0 (from Stellar Reviews), with
// WeGrocery's name, logo and light theme. lib/email/resend.ts adds it to
// every message it sends.

export const APP_NAME = "WeGrocery";

// WeGrocery's light theme: a mail client reads no stylesheet and no CSS
// variables, so the values are copied here. WeGrocery names its tokens its own
// way (Playbook 2.2 deviation): card is --surface, muted-foreground is --muted,
// and the brand roles (background, primary-text, muted) come from
// lib/brand/roles.ts for the default WeGrocery palette, since app/layout.tsx
// sets them per group. border is --border (a translucent grey) over the card.
// lib/email/layout.test.ts checks they match.
export const EMAIL_THEME = {
  background: "#faf8f5",
  card: "#ffffff",
  foreground: "#2d2b29",
  mutedForeground: "#6b6b6b",
  primaryText: "#8e6014",
  border: "#eeeeef",
} as const;

export const FLYLABS_URL = "https://flylabs.ai";
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

function linkify(escaped: string): string {
  return escaped.replace(URL_RE, (match) => {
    const url = match.replace(/[.,;:!?)\]]+$/, "");
    const rest = match.slice(url.length);
    return `<a href="${url}" style="color:${EMAIL_THEME.primaryText};text-decoration:underline;word-break:break-all">${url}</a>${rest}`;
  });
}

// Paragraphs on blank lines, a <br> on a single newline.
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph, i, all) => {
      const body = paragraph.split("\n").map((line) => linkify(escapeHtml(line))).join("<br>");
      // The card's padding closes the last one.
      const margin = i === all.length - 1 ? "0" : "0 0 16px 0";
      return `<p style="margin:${margin}">${body}</p>`;
    })
    .join("\n");
}

function footer(baseUrl: string): string {
  const flylabs = `<a href="${FLYLABS_URL}" style="color:${EMAIL_THEME.mutedForeground};text-decoration:none">By <span style="text-decoration:underline">FlyLabs.ai</span></a>`;
  // Without a base URL there is no address for the logo: the name in text.
  const brand = baseUrl
    ? `<a href="${baseUrl}"><img src="${baseUrl}${LOGO_PATH}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${escapeHtml(APP_NAME)}" style="display:block;border:0;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px"></a>`
    : `<span style="font-weight:600;color:${EMAIL_THEME.foreground}">${escapeHtml(APP_NAME)}</span>`;
  return `<tr><td style="padding:24px 8px 0 8px">${brand}<div style="padding-top:8px;font-family:${FONT};font-size:13px;line-height:20px">${flylabs}</div></td></tr>`;
}

export function emailHtml(text: string, opts: { subject: string; baseUrl: string }): string {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");
  const t = EMAIL_THEME;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${t.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.background}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:${t.card};border:1px solid ${t.border};border-radius:16px;padding:28px 24px;font-family:${FONT};font-size:15px;line-height:24px;color:${t.foreground}">
${textToHtml(text)}
</td></tr>
${footer(baseUrl)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

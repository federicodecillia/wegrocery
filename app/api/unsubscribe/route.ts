import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { disableEmailForCategory } from "@/lib/notifications/unsubscribe-store";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getBrand } from "@/lib/brand/get-brand";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/observability";

// One-click unsubscribe from a notification email (RFC 8058). Public: the
// signature in `t` is the proof (lib/email/unsubscribe.ts). A mail client
// POSTs `List-Unsubscribe=One-Click`; a person who opens the link in a browser
// gets a button that does the same POST, because mail scanners open links and a
// GET must never change anything. A bad signature answers 400 and nothing else.

const html = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="${brand.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;line-height:1.5">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

function token(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

export async function GET(request: Request) {
  const claims = verifyUnsubscribeToken(token(request), process.env.AUTH_SECRET ?? "");
  if (!claims) return html(t.unsubscribe.invalidTitle, `<p>${t.unsubscribe.invalid}</p>`, 400);
  const identity = await getBrand();
  return html(
    t.unsubscribe.title,
    `<h1 style="font-size:20px">${t.unsubscribe.title}</h1><p>${t.unsubscribe.confirm(t.notifications.settings.categories[claims.category].label, identity.appName)}</p>` +
      `<form method="post" action="/api/unsubscribe?t=${encodeURIComponent(token(request))}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="min-height:44px;padding:0 20px;font-size:16px">${t.unsubscribe.button}</button></form>`,
  );
}

export async function POST(request: Request) {
  const claims = verifyUnsubscribeToken(token(request), process.env.AUTH_SECRET ?? "");
  if (!claims) return html(t.unsubscribe.invalidTitle, `<p>${t.unsubscribe.invalid}</p>`, 400);
  try {
    await disableEmailForCategory(getDb(), claims.memberId, claims.category);
  } catch (e) {
    reportError("api/unsubscribe", e);
    return html(t.unsubscribe.invalidTitle, `<p>${t.errors.genericError}</p>`, 500);
  }
  return html(t.unsubscribe.doneTitle, `<h1 style="font-size:20px">${t.unsubscribe.doneTitle}</h1><p>${t.unsubscribe.done}</p>`);
}

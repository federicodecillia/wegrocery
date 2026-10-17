import { getBrand } from "@/lib/brand/get-brand";
import { safeCallbackPath } from "@/lib/auth/hosts";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.login.pageTitle };

// Where the email link lands. Mail scanners open links, and Better Auth's link
// works once: the link itself only shows this page, and the member's tap on
// the button (a form GET that scanners do not submit) is what signs them in.
export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const brand = await getBrand();
  const { token, next } = await searchParams;
  const callbackURL = safeCallbackPath(next);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <div className="w-full rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{brand.appName}</h1>
        {token ? (
          <form action="/api/auth/magic-link/verify" method="get" className="mt-4 space-y-3">
            <p className="text-sm text-secondary-foreground">{t.login.confirmMessage}</p>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="callbackURL" value={callbackURL} />
            <input type="hidden" name="errorCallbackURL" value="/login?error=LinkInvalid" />
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              {t.login.confirmButton}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-secondary-foreground">{t.login.linkInvalid}</p>
        )}
      </div>
    </main>
  );
}

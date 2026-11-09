import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { getBrand } from "@/lib/brand/get-brand";
import { t } from "@/lib/i18n";
import { mustAcceptTerms } from "@/lib/members/terms";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: t.signup.pageTitle };
// The mode is read on every visit: an admin may switch it at any time.
export const dynamic = "force-dynamic";

// How to join the group, without a session (proxy.ts lets it through). What
// it shows follows the sign-up mode (lib/membership/signup.ts): the request
// form, how to sign up with the email link, or that the group takes members
// by invitation only.
export default async function JoinPage() {
  const [brand, settings] = await Promise.all([getBrand(), getPaymentSettings()]);
  const s = t.signup;
  const mode = settings.signupMode;
  const termsNeeded = mustAcceptTerms(settings, brand, null);
  const loginLink =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-bold text-primary-foreground";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <div className="w-full rounded-card border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex justify-center">
          <BrandLogo src={brand.logoUrl} alt="" shortName={brand.shortName} />
        </div>
        <h1 className="text-center text-title font-black text-foreground">{s.title(brand.appName)}</h1>
        {mode === "request" ? (
          <>
            <p className="mt-2 text-center text-sm text-secondary-foreground">{s.requestIntro}</p>
            <SignupForm
              termsNeeded={termsNeeded}
              privacyUrl={brand.privacyUrl}
              termsUrl={brand.termsUrl}
            />
          </>
        ) : mode === "open" ? (
          <>
            <p className="mt-2 text-center text-sm text-secondary-foreground">{s.openIntro}</p>
            <Link href="/login" className={`mt-5 ${loginLink}`}>
              {s.openButton}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-center text-sm text-secondary-foreground">{s.closedIntro}</p>
            <p className="mt-2 text-center text-sm text-secondary-foreground">
              {t.login.contactSupport}{" "}
              <a href={`mailto:${brand.supportEmail}`} className="font-medium text-foreground underline">
                {brand.supportEmail}
              </a>
            </p>
          </>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-foreground underline">
            {s.haveAccount}
          </Link>
        </p>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { googleCredentials } from "@/lib/auth/config";
import { LoginForm } from "./login-form";
import { ShortcutButtons } from "./shortcut-buttons";
import { DemoBanner } from "@/components/demo-banner";
import { BrandLogo } from "@/components/brand-logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.login.pageTitle };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const deniedMessage =
    error === "AccessDenied"
      ? t.login.accessDenied
      : error === "NotMember"
        ? t.login.notMember
        : error === "MembershipInactive"
          ? t.login.membershipInactive
          : error === "MembershipCheckUnavailable"
            ? t.login.membershipCheckUnavailable
            : error === "LinkInvalid" || error === "INVALID_TOKEN" || error === "EXPIRED_TOKEN"
              ? t.login.linkInvalid
              : error === "failed_to_create_session" || error === "unable_to_create_session"
                ? t.login.accessDenied
                : null;
  const hasGoogleAuth = googleCredentials(process.env) !== null;
  const hasDevLogin = process.env.NODE_ENV !== "production" && Boolean(process.env.AUTH_DEV_LOGIN_EMAIL);
  const isDemo = process.env.DEMO_MODE === "true";

  if (session?.user?.email) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <div className="w-full overflow-hidden rounded-card border border-brand-border bg-white shadow-card">
        {/* The demo notice is the card's top edge, as wide as the card. */}
        <DemoBanner />
        <div className="p-6">
        <div className="mb-4 flex justify-center">
          <BrandLogo src={brand.logoUrl} alt="" shortName={brand.shortName} />
        </div>
        <h1 className="text-center text-title font-black text-brand-near-black">{brand.appName}</h1>
        <p className="mt-2 text-center text-sm text-brand-gray">
          {isDemo ? t.login.demoMessage : t.login.continueMessage}
        </p>
        {deniedMessage ? (
          <div role="alert" className="mt-3 space-y-1 rounded-xl border border-brand-red/30 bg-brand-red-light p-3 text-sm text-brand-red">
            <p>{deniedMessage}</p>
            {error === "MembershipInactive" && brand.membershipUrl ? (
              <p>
                <a href={brand.membershipUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  {t.login.renewMembership}
                </a>
              </p>
            ) : null}
            <p>
              {t.login.contactSupport}{" "}
              <a href={`mailto:${brand.supportEmail}`} className="font-medium underline">
                {brand.supportEmail}
              </a>
            </p>
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          {isDemo ? null : <LoginForm googleEnabled={hasGoogleAuth} next="/" />}
          {isDemo || hasDevLogin ? <ShortcutButtons demo={isDemo} dev={hasDevLogin} /> : null}
        </div>
        </div>
      </div>
      {brand.privacyUrl ? (
        <a
          href={brand.privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-gray mt-4 text-xs underline"
        >
          {t.login.privacyLink}
        </a>
      ) : null}
    </main>
  );
}

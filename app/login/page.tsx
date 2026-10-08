import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { googleCredentials } from "@/lib/auth/config";
import { LoginForm } from "./login-form";
import { ShortcutButtons } from "./shortcut-buttons";
import { DemoBanner } from "@/components/demo-banner";
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
      <DemoBanner />
      <div className="w-full rounded-lg border border-brand-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{brand.appName}</h1>
        <p className="text-brand-gray mt-2 text-sm">
          {isDemo ? t.login.demoMessage : t.login.continueMessage}
        </p>
        {deniedMessage ? (
          <div className="mt-3 space-y-1 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
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

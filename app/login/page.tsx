import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/demo-banner";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const showConfigError = error === "Configuration";
  // Set by the signIn callback on denial; echoed back so the member can spot
  // a sign-in with the wrong Google account.
  const attemptedEmail = typeof params.email === "string" ? params.email.slice(0, 254) : null;
  const deniedMessage =
    error === "AccessDenied"
      ? t.login.accessDenied
      : error === "NotMember"
        ? t.login.notMember
        : error === "MembershipInactive"
          ? t.login.membershipInactive
          : error === "MembershipCheckUnavailable"
            ? t.login.membershipCheckUnavailable
            : null;
  const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
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
            {attemptedEmail ? <p className="break-all">{t.login.attemptedEmail(attemptedEmail)}</p> : null}
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
        {showConfigError ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {t.login.configError}
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          {hasGoogleAuth ? (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="teal" block>
                {t.login.googleLogin}
              </Button>
            </form>
          ) : null}
          {hasDevLogin ? (
            <form
              action={async () => {
                "use server";
                await signIn("dev-login", { redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="orange" block>
                {t.login.devLogin}
              </Button>
            </form>
          ) : null}
          {isDemo ? (
            <>
              <form
                action={async () => {
                  "use server";
                  await signIn("demo-login", { profile: "socio", redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="teal" block>
                  {t.login.memberLogin}
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("demo-login", { profile: "admin", redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="orange" block>
                  {t.login.adminLogin}
                </Button>
              </form>
            </>
          ) : null}
          {hasGoogleAuth && !isDemo ? (
            <p className="text-brand-gray text-xs">{t.login.googleAccountHint}</p>
          ) : null}
          {!hasGoogleAuth && !hasDevLogin && !isDemo ? (
            <p className="rounded-md border border-brand-border bg-brand-warm-white p-2 text-sm text-brand-gray">
              {t.login.configMissing}
            </p>
          ) : null}
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

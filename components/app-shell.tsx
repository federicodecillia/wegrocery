import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getBrand } from "@/lib/brand/get-brand";
import { t } from "@/lib/i18n";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { CONTENT_WIDTH, SHELL_WIDTH, type ShellLayout } from "@/components/shell-width";
import { SideNav } from "@/components/side-nav";
import { WelcomeResume } from "@/components/home/welcome-resume";
import { AppRefresh } from "@/components/app-refresh";
import { NamePrompt } from "@/components/name-prompt";
import { TermsPrompt } from "@/components/terms-prompt";
import { termsPending } from "@/lib/members/terms-gate";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { getUnreadNotificationCount, notificationOwners } from "@/lib/db/queries";
import { namePromptFor } from "@/lib/members/name-prompt";
import type { AdminAccess } from "@/lib/roles";

type AppShellProps = {
  children: ReactNode;
  email: string;
  /** The signed-in person's name, for the avatar's initials (session.user.fullName). */
  name?: string | null;
  /** How much of Admin the person may open (lib/auth/access.ts adminAccess): the Admin item and its sections. */
  admin: AdminAccess | null;
  memberId: string;
  /** Who signed in, when they work on a family's account: their own notifications count too. */
  personId?: string | null;
  /** From lg: a reading column (the default) or the whole card (Home, Admin). */
  layout?: ShellLayout;
};

export async function AppShell({ children, email, name, admin, memberId, personId, layout = "reading" }: AppShellProps) {
  const brand = await getBrand();
  const [unreadCount, namePrompt, mustAccept, settings] = await Promise.all([
    getUnreadNotificationCount(notificationOwners(memberId, personId)),
    // A member still named after their address answers first (lib/members/name.ts).
    namePromptFor(personId ?? memberId),
    // The group's privacy notice and terms come before anything (lib/members/terms.ts).
    termsPending(personId ?? memberId),
    getPaymentSettings(),
  ]);
  const signOutAction = async () => {
    "use server";
    await signOut();
    redirect("/login");
  };
  const blocking = mustAccept || namePrompt !== null;

  return (
    <div className="min-h-screen bg-frame sm:p-6 md:flex md:bg-background md:p-0">
      {/* From md the rail (tablet) or sidebar (PC) replaces the header and the bottom bar. */}
      <Suspense>
        <SideNav
          admin={admin}
          unreadCount={unreadCount}
          name={name}
          email={email}
          appName={brand.appName}
          logoUrl={brand.logoUrl}
          showName={brand.headerShowName}
        />
      </Suspense>
      {/* The card width comes from SHELL_WIDTH, the same on every page. Keep
          the loading.tsx skeletons and the OrderTotals sticky footer
          (app/ordine) in sync with this layout. */}
      {/* overflow-clip (not hidden): hidden would create a scroll container
          and break position:sticky for BottomNav and the order footer. */}
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-background sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-border sm:shadow-sm md:min-h-screen md:min-w-0 md:flex-1 md:rounded-none md:border-0 md:shadow-none ${SHELL_WIDTH}`}
      >
        {/* First stop for keyboard users: past the header and the nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-full focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-inverse-foreground"
        >
          {t.common.skipToContent}
        </a>
        <DemoBanner />
        <header className="border-b border-border px-5 py-4 md:hidden">
          {/* One row: logo, then (from lg) the menu, then the bell and the avatar. */}
          <div className="flex items-center justify-between gap-3 lg:gap-6">
            {/* A long app name wraps instead of pushing the avatar off the card. */}
            <div className="min-w-0 lg:shrink-0">
              <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center gap-2">
                <Image src={brand.logoUrl} alt={brand.appName} width={26} height={26} priority className="h-[26px] w-auto shrink-0" />
                {brand.headerShowName && (
                  <span className="text-[15px] font-semibold text-foreground">{brand.appName}</span>
                )}
              </Link>
            </div>
            {/* The email, sign-out and personal settings are in the Profile (app/profilo). */}
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell unreadCount={unreadCount} />
              <ProfileAvatar name={name} email={email} />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] md:px-8 md:py-6">
          <AppRefresh />
          {!blocking && <WelcomeResume />}
          <div className={CONTENT_WIDTH[layout]}>
          {mustAccept && settings.termsVersion ? (
            <TermsPrompt
              group={brand.appName}
              version={settings.termsVersion}
              privacyUrl={brand.privacyUrl}
              termsUrl={brand.termsUrl}
              signOut={signOutAction}
            />
          ) : namePrompt ? (
            <NamePrompt currentName={name ?? ""} required={namePrompt === "required"} signOut={signOutAction} />
          ) : (
            children
          )}
          {brand.privacyUrl || brand.termsUrl ? (
            <p className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs">
              {brand.privacyUrl ? (
                <a href={brand.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground underline">
                  {t.login.privacyLink}
                </a>
              ) : null}
              {brand.termsUrl ? (
                <a href={brand.termsUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground underline">
                  {t.login.termsLink}
                </a>
              ) : null}
            </p>
          ) : null}
          </div>
        </main>
        <BottomNav isAdmin={admin !== null} />
      </div>
    </div>
  );
}

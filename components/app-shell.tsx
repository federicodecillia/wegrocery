import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { SHELL_WIDTH, type ShellWidth } from "@/components/shell-width";
import { TopNav } from "@/components/top-nav";
import { WelcomeResume } from "@/components/home/welcome-resume";
import { AppRefresh } from "@/components/app-refresh";
import { getUnreadNotificationCount, notificationOwners } from "@/lib/db/queries";

type AppShellProps = {
  children: ReactNode;
  email: string;
  /** The signed-in person's name, for the avatar's initials (session.user.fullName). */
  name?: string | null;
  isAdmin: boolean;
  memberId: string;
  /** Who signed in, when they work on a family's account: their own notifications count too. */
  personId?: string | null;
  /** Admin pages widen on desktop; everything else stays a readable column. */
  width?: ShellWidth;
};

export async function AppShell({ children, email, name, isAdmin, memberId, personId, width = "member" }: AppShellProps) {
  const unreadCount = await getUnreadNotificationCount(notificationOwners(memberId, personId));

  return (
    <div className="min-h-screen bg-brand-frame sm:p-6">
      {/* The card width comes from SHELL_WIDTH: it changes only when entering
          or leaving Admin on desktop. Keep the loading.tsx skeletons and the
          OrderTotals sticky footer (app/ordine) in sync with this layout. */}
      {/* overflow-clip (not hidden): hidden would create a scroll container
          and break position:sticky for BottomNav and the order footer. */}
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm ${SHELL_WIDTH[width]}`}
      >
        {/* First stop for keyboard users: past the header and the nav. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-full focus:bg-brand-near-black focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          {t.common.skipToContent}
        </a>
        <DemoBanner />
        <header className="border-b border-brand-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* A long app name wraps instead of pushing the avatar off the card. */}
            <div className="min-w-0">
              <Link href="/" aria-label={t.nav.home} className="inline-flex min-h-11 items-center gap-2">
                <Image src={brand.logoUrl} alt={brand.appName} width={26} height={26} priority className="h-[26px] w-auto shrink-0" />
                {brand.headerShowName && (
                  <span className="text-[15px] font-semibold text-brand-near-black">{brand.appName}</span>
                )}
              </Link>
            </div>
            {/* The email, sign-out and personal settings are in the Profile (app/profilo). */}
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell unreadCount={unreadCount} />
              <ProfileAvatar name={name} email={email} />
            </div>
          </div>
          <TopNav isAdmin={isAdmin} />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] lg:pb-4">
          <AppRefresh />
          <WelcomeResume />
          {children}
          {brand.privacyUrl ? (
            <p className="mt-8 text-center text-xs">
              <a href={brand.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-brand-gray underline">
                {t.login.privacyLink}
              </a>
            </p>
          ) : null}
        </main>
        <BottomNav isAdmin={isAdmin} />
      </div>
    </div>
  );
}

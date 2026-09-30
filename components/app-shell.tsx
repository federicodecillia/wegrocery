import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { BottomNav } from "@/components/bottom-nav";
import { DemoBanner } from "@/components/demo-banner";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { SHELL_WIDTH, type ShellWidth } from "@/components/shell-width";
import { TopNav } from "@/components/top-nav";
import { getUnreadNotificationCount } from "@/lib/db/queries";

type AppShellProps = {
  children: ReactNode;
  email: string;
  isAdmin: boolean;
  memberId: string;
  /** Admin pages widen on desktop; everything else stays a readable column. */
  width?: ShellWidth;
};

export async function AppShell({ children, email, isAdmin, memberId, width = "member" }: AppShellProps) {
  const unreadCount = await getUnreadNotificationCount(memberId);

  return (
    <div className="min-h-screen bg-brand-frame sm:p-6">
      {/* The card width comes from SHELL_WIDTH: it changes only when entering
          or leaving Admin on desktop. Keep the loading.tsx skeletons and the
          OrderForm sticky footer in sync with this layout. */}
      {/* overflow-clip (not hidden): hidden would create a scroll container
          and break position:sticky for BottomNav and the order footer. */}
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm ${SHELL_WIDTH[width]}`}
      >
        <DemoBanner />
        <header className="border-b border-brand-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0">
              <Link href="/" aria-label="Home" className="inline-flex items-center gap-2">
                <Image src={brand.logoUrl} alt={brand.appName} width={26} height={26} priority className="h-[26px] w-auto" />
                {brand.headerShowName && (
                  <span className="text-[15px] font-semibold text-brand-near-black">{brand.appName}</span>
                )}
              </Link>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {/* On phones the email is on the Notifications page instead. */}
              <span className="hidden min-w-0 truncate text-xs text-brand-gray sm:block">{email}</span>
              <NotificationBell unreadCount={unreadCount} />
              <LogoutButton
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              />
            </div>
          </div>
          <TopNav isAdmin={isAdmin} />
        </header>

        <main className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] lg:pb-4">
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

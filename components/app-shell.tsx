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
import { getUnreadNotificationCount } from "@/lib/db/queries";

type AppShellProps = {
  children: ReactNode;
  email: string;
  isAdmin: boolean;
  memberId: string;
};

export async function AppShell({ children, email, isAdmin, memberId }: AppShellProps) {
  const unreadCount = await getUnreadNotificationCount(memberId);

  return (
    <div className="min-h-screen bg-brand-frame sm:p-6">
      {/* Same card widths on every view (member and admin) so navigating
          between tabs never resizes the window. Keep in sync with the
          loading.tsx skeletons and the OrderForm sticky footer. */}
      {/* overflow-clip (not hidden): hidden would create a scroll container
          and break position:sticky for BottomNav and the order footer. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm md:max-w-[640px] lg:max-w-[960px]">
        <DemoBanner />
        <header className="border-b border-brand-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href="/" aria-label="Home" className="inline-flex items-center gap-2">
                <Image src={brand.logoUrl} alt={brand.appName} width={26} height={26} priority className="h-[26px] w-auto" />
                {brand.headerShowName && (
                  <span className="text-[15px] font-semibold text-brand-near-black">{brand.appName}</span>
                )}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell unreadCount={unreadCount} />
              <LogoutButton
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              />
            </div>
          </div>
          <p className="text-brand-gray mt-3 truncate text-xs">{email}</p>
        </header>

        <main className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)]">
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

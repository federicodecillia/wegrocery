import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CycleCalendar } from "@/components/calendar/cycle-calendar";
import { BackLink } from "@/components/ui/back-link";
import { adminAccess } from "@/lib/auth/access";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { buildCalendar, dayOf } from "@/lib/calendar";
import { getCalendarCycles } from "@/lib/db/calendar";
import { getFamilyMemberIds } from "@/lib/db/queries";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.calendar.title };

// The order calendar: the cycles the member can see, by day (lib/calendar.ts).
// Reached from Home and from Ordine when nothing is open.
export default async function CalendarioPage() {
  const session = await requireUserSession();
  const memberId = session.user.memberId!;
  // A family's account counts the orders its people placed too, as in Storico.
  const memberIds = await getFamilyMemberIds(memberId);
  const rows = await getCalendarCycles(getUserRole(session), memberIds);
  const now = new Date();

  return (
    <AppShell email={session.user.email} name={session.user.fullName} admin={adminAccess(session.user)} memberId={memberId} personId={session.user.personId} layout="wide">
      <BackLink href="/">{t.nav.home}</BackLink>
      <h1 className="mt-1 text-title font-black text-foreground">{t.calendar.title}</h1>
      <p className="mb-4 mt-1 max-w-prose text-[14px] text-secondary-foreground">{t.calendar.intro}</p>
      <CycleCalendar entries={buildCalendar(rows, now)} today={dayOf(now)} />
    </AppShell>
  );
}

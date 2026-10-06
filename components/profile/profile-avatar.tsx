import Link from "next/link";
import { t } from "@/lib/i18n";
import { initials } from "@/lib/profile/summary";

// Header entry to the Profile page (app/profilo): the member's initials.
export function ProfileAvatar({ name, email }: { name?: string | null; email: string }) {
  return (
    <Link
      href="/profilo"
      aria-label={t.profile.title}
      title={t.profile.title}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-black tracking-tight text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {initials(name, email)}
    </Link>
  );
}

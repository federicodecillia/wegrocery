import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { ADMIN_GUIDE_HREF } from "@/lib/admin/nav";
import { t } from "@/lib/i18n";

// At the top of /guida, for admins only (the page renders it only when
// adminGuideFor returns the guide): the way into the admin guide.
export function AdminGuideCard() {
  return (
    <Link
      href={ADMIN_GUIDE_HREF}
      className="mb-6 flex gap-3 rounded-card border border-primary-mid bg-primary-bg p-4 shadow-card transition-colors hover:border-primary"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-primary-text">
        <UiIcon name="shield" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-foreground">{t.guide.adminTitle}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-secondary-foreground">{t.guide.adminCardBody}</span>
      </span>
    </Link>
  );
}

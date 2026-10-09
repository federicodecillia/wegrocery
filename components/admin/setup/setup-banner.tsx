import Link from "next/link";
import { getGroupIdentity } from "@/lib/brand/get-brand";
import { setupHref } from "@/lib/admin/setup-steps";
import { t } from "@/lib/i18n";

// Shown to admins until someone finishes the first-run setup (app/admin/avvio).
// Installations that already had members were marked as set up by migration
// 0034, so only a new group sees it.
export async function SetupBanner() {
  const identity = await getGroupIdentity();
  if (identity.setupCompletedAt) return null;
  const s = t.admin.setup.banner;
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary-mid bg-primary-soft p-4 shadow-card">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-brand-near-black">{s.title}</h2>
        <p className="mt-[2px] text-[13px] text-brand-gray">{s.body}</p>
      </div>
      <Link
        href={setupHref("identity")}
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 py-2 text-[14px] font-bold text-on-primary"
      >
        {s.cta}
      </Link>
    </section>
  );
}

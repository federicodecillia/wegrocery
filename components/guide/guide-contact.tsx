import { getBrand } from "@/lib/brand/get-brand";
import { EmptyIcon } from "@/components/ui-icon";
import { t } from "@/lib/i18n";

// "Other questions?": the group's support and technical addresses, last on
// every guide page.
export async function GuideContact() {
  const brand = await getBrand();
  const sameAddress = brand.techEmail.trim().toLowerCase() === brand.supportEmail.trim().toLowerCase();
  return (
    <div className="mt-6 rounded-card border border-border bg-card p-6 text-center shadow-card">
      <div className="mb-2.5 flex justify-center">
        <EmptyIcon name="mail" />
      </div>
      <div className="mb-1.5 text-[15px] font-bold text-foreground">{t.guide.contactHeading}</div>
      <p className="mb-4 text-[14px] text-secondary-foreground">{t.guide.contactIntro(brand.appName)}</p>
      {/* Each button says what it is for, the address under it; one button
          when the group uses a single address for both. */}
      <div className="flex flex-col gap-3">
        <a
          href={`mailto:${brand.supportEmail}`}
          className="inline-flex min-h-11 flex-col items-center justify-center rounded-full bg-primary px-5.5 py-2.5 text-primary-foreground no-underline transition-transform active:scale-95"
        >
          <span className="text-sm font-bold">{t.guide.contactGroup}</span>
          <span className="text-label">{brand.supportEmail}</span>
        </a>
        {sameAddress ? null : (
          <a
            href={`mailto:${brand.techEmail}`}
            className="inline-flex min-h-11 flex-col items-center justify-center rounded-full border border-border bg-card px-5.5 py-2.5 text-foreground no-underline transition-transform active:scale-95"
          >
            <span className="text-sm font-bold">{t.guide.contactTech}</span>
            <span className="text-label text-secondary-foreground">{brand.techEmail}</span>
          </a>
        )}
      </div>
    </div>
  );
}

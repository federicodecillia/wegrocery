import { getBrand } from "@/lib/brand/get-brand";
import { EmptyIcon } from "@/components/ui-icon";
import { t } from "@/lib/i18n";

// "Other questions?": the group's support and technical addresses, last on
// every guide page.
export async function GuideContact() {
  const brand = await getBrand();
  const sameAddress = brand.techEmail.trim().toLowerCase() === brand.supportEmail.trim().toLowerCase();
  return (
    <div className="mt-6 rounded-card border border-brand-border bg-white p-6 text-center shadow-card">
      <div className="mb-[10px] flex justify-center">
        <EmptyIcon name="mail" />
      </div>
      <div className="mb-[6px] text-[15px] font-bold text-brand-near-black">{t.guide.contactHeading}</div>
      <p className="mb-4 text-[14px] text-brand-gray">{t.guide.contactIntro(brand.appName)}</p>
      {/* Each button says what it is for, the address under it; one button
          when the group uses a single address for both. */}
      <div className="flex flex-col gap-3">
        <a
          href={`mailto:${brand.supportEmail}`}
          className="inline-flex min-h-11 flex-col items-center justify-center rounded-full bg-primary px-[22px] py-[10px] text-on-primary no-underline transition-transform active:scale-95"
        >
          <span className="text-sm font-bold">{t.guide.contactGroup}</span>
          <span className="text-label">{brand.supportEmail}</span>
        </a>
        {sameAddress ? null : (
          <a
            href={`mailto:${brand.techEmail}`}
            className="inline-flex min-h-11 flex-col items-center justify-center rounded-full border border-brand-border bg-white px-[22px] py-[10px] text-brand-near-black no-underline transition-transform active:scale-95"
          >
            <span className="text-sm font-bold">{t.guide.contactTech}</span>
            <span className="text-label text-brand-gray">{brand.techEmail}</span>
          </a>
        )}
      </div>
    </div>
  );
}

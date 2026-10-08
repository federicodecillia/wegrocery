import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";

// "Other questions?": the group's support and technical addresses, last on
// every guide page.
export function GuideContact() {
  return (
    <div className="mt-6 rounded-card border border-brand-border bg-white p-6 text-center shadow-card">
      <div className="mb-[10px] text-[32px]">{t.guide.contactEmoji}</div>
      <div className="mb-[6px] text-[15px] font-bold text-brand-near-black">{t.guide.contactHeading}</div>
      <p className="mb-4 text-[14px] text-brand-gray">{t.guide.contactIntro(brand.appName)}</p>
      <div className="flex flex-col gap-3">
        <a
          href={`mailto:${brand.supportEmail}`}
          className="inline-flex items-center justify-center rounded-full bg-primary px-[22px] py-[12px] text-sm font-bold text-on-primary no-underline transition-transform active:scale-95"
        >
          {brand.supportEmail}
        </a>
        <a
          href={`mailto:${brand.techEmail}`}
          className="inline-flex items-center justify-center rounded-full bg-brand-near-black px-[22px] py-[12px] text-sm font-bold text-white no-underline transition-transform active:scale-95"
        >
          {brand.techEmail}
        </a>
      </div>
    </div>
  );
}

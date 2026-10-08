import Link from "next/link";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";

type Props = {
  cycles: {
    cycleId: string;
    title: string;
    supplierName: string | null;
    orderCloseAt: Date | null;
  }[];
};

/** Shown on /ordine when several cycles are open and the link did not say
 * which one (e.g. the bottom nav): the member picks, instead of landing on
 * whichever closes first. */
export function CycleChooser({ cycles }: Props) {
  return (
    <>
      <h1 className="text-title font-black text-brand-near-black">
        {t.order.chooseCycle}
      </h1>
      <p className="mt-[3px] text-[14px] text-brand-gray">{t.order.chooseCycleHint}</p>
      <div className="mt-4 space-y-3">
        {cycles.map((c) => (
          <Link
            key={c.cycleId}
            href={`/ordine?cycleId=${c.cycleId}`}
            className="flex items-center justify-between gap-3 rounded-card border border-brand-border bg-white p-[18px] shadow-card"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-[-0.01em] text-brand-near-black">
                {c.title}
              </div>
              <div className="mt-[3px] font-mono text-label text-brand-gray">
                {[c.supplierName, c.orderCloseAt ? t.cycle.closes(formatDateTime(c.orderCloseAt)) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span className="shrink-0 text-[18px] font-bold text-primary-text" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

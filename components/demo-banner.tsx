import { t } from "@/lib/i18n";

export function DemoBanner() {
  if (process.env.DEMO_MODE !== "true") return null;
  return (
    <div className="border-b border-primary-mid bg-primary-soft px-4 py-2 text-center text-xs font-medium text-brand-near-black">
      {t.demo.banner}
    </div>
  );
}

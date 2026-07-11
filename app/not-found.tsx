import Link from "next/link";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center p-6 text-center"
      style={{ background: "var(--frame)" }}
    >
      <div className="w-full max-w-[320px] rounded-[18px] border border-brand-border bg-white p-6 shadow-sm">
        <p className="font-mono text-[40px] font-bold text-brand-gray-light">404</p>
        <p className="mt-1 text-[15px] font-semibold text-brand-near-black">{t.common.pageNotFound}</p>
        <Link
          href="/"
          className="mt-4 block w-full rounded-xl bg-brand-orange py-2.5 text-[13px] font-bold text-white"
        >
          {t.common.backToHome}
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { t } from "@/lib/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center p-6 text-center"
      style={{ background: "var(--frame)" }}
    >
      <div className="w-full max-w-[320px] rounded-[18px] border border-brand-border bg-white p-6 shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-light text-2xl">
          ⚠
        </div>
        <p className="text-[15px] font-semibold text-brand-near-black">{t.common.somethingWentWrong}</p>
        <p className="mt-1 text-[13px] text-brand-gray">{error.message || t.common.unexpectedError}</p>
        <button
          onClick={reset}
          className="mt-4 w-full rounded-xl bg-brand-orange py-2.5 text-[13px] font-bold text-white"
        >
          {t.common.retry}
        </button>
      </div>
    </div>
  );
}

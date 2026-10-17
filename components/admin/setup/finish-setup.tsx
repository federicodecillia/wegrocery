"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminCompleteSetup } from "@/lib/actions/admin-identity";
import { t } from "@/lib/i18n";

// The last step of the first-run setup: Admin stops offering it.
export function FinishSetup() {
  const s = t.admin.setup;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleFinish() {
    startTransition(async () => {
      const result = await adminCompleteSetup();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.finished);
      router.push("/admin?tab=soci");
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-[15px] font-bold text-foreground">{s.finishTitle}</h2>
      <p className="mt-1 text-[13px] text-secondary-foreground">{s.finishBody}</p>
      <button
        type="button"
        onClick={handleFinish}
        disabled={isPending}
        className="mt-4 min-h-11 rounded-full bg-primary px-5 py-2 text-[14px] font-bold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : s.finishButton}
      </button>
    </section>
  );
}

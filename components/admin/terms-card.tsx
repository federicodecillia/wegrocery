"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetTermsRequired } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";

// Impostazioni -> Gruppo: whether whoever signs in must accept the privacy
// notice and terms first (components/terms-prompt.tsx), and "ask everyone
// again" when the texts change. The links themselves are in Contatti e link.
export function TermsCard({
  required,
  versionLabel,
  hasLink,
}: {
  required: boolean;
  /** The version in force, formatted; null when none yet. */
  versionLabel: string | null;
  hasLink: boolean;
}) {
  const s = t.admin.settings.terms;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: "on" | "off" | "renew") {
    startTransition(async () => {
      const result = await adminSetTermsRequired(action);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  const button =
    "min-h-11 rounded-xl border border-border px-4 py-2 text-[13px] font-bold text-foreground disabled:opacity-60";
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">
        {s.title}: {required ? s.on : s.off}
      </h3>
      <p className="mt-1 text-[12px] text-secondary-foreground">{s.hint}</p>
      {!hasLink && <p className="mt-1 text-[12px] font-medium text-foreground">{s.needsLink}</p>}
      {required && versionLabel && <p className="mt-1 text-[12px] text-secondary-foreground">{s.version(versionLabel)}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(required ? "off" : "on")}
          disabled={isPending || (!required && !hasLink)}
          className={button}
        >
          {isPending ? t.admin.common.saving : required ? s.disable : s.enable}
        </button>
        {required && (
          <button type="button" onClick={() => run("renew")} disabled={isPending || !hasLink} className={button}>
            {s.renew}
          </button>
        )}
      </div>
      {required && <p className="mt-2 text-[12px] text-secondary-foreground">{s.renewHint}</p>}
    </section>
  );
}

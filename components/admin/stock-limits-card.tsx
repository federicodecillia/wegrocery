"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminSetStockLimitsEnabled } from "@/lib/actions/admin-settings";
import { t } from "@/lib/i18n";

// Impostazioni -> Gruppo -> Quantità limitate: the fields "Disponibili" and
// "Massimo per socio" on the cycle's products (lib/products/stock.ts).
export function StockLimitsCard({ enabled }: { enabled: boolean }) {
  const s = t.admin.settings.stock;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(next: boolean) {
    startTransition(async () => {
      const result = await adminSetStockLimitsEnabled(next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(s.saved);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-[13px] font-bold text-foreground">{s.title}</h3>
      <p className="text-[12px] text-secondary-foreground">{s.hint}</p>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5">
        <input
          type="checkbox"
          checked={enabled}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          <span className="block text-[13px] font-semibold text-foreground">{s.enabled}</span>
          <span className="block text-[12px] text-secondary-foreground">{s.enabledHint}</span>
        </span>
      </label>
    </section>
  );
}

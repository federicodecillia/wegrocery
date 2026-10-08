"use client";

import { useTransition } from "react";
import { adminBuildSupplierDistinta } from "@/lib/actions/admin";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ── CSV Export ────────────────────────────────────────────────────────────────

// Downloads the same canonical xlsx workbook that the Supplier actions
// dialog ships (Distinta + Riepilogo + Totali per prodotto). One file,
// one source of truth — no more divergent CSVs.
export function CsvExportButton({ cycleId }: { cycleId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const r = await adminBuildSupplierDistinta(cycleId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const blob = decodeBase64ToBlob(
        r.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      onClick={handleExport}
      disabled={isPending}
      className="min-h-10 rounded-xl border border-brand-border bg-white px-4 text-[13px] font-semibold text-brand-near-black disabled:opacity-60"
    >
      {isPending ? t.admin.orders.generatingExcel : t.admin.orders.downloadExcel}
    </button>
  );
}

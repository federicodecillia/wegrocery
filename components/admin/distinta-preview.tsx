"use client";

import type { DistintaImportPreview } from "@/lib/csv/distinta-parser";
import { formatEur } from "@/lib/utils";
import { t } from "@/lib/i18n";

// What a supplier sheet would change, before anything is written: shown in
// Fornitore, step 3, and in the cycle-close sheet when closing with it.

export const DISTINTA_ACCEPT =
  ".xlsx,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv";

/** The file's bytes as base64 (no data: prefix), for the server actions. */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(t.admin.supplierActions.cannotReadFile));
        return;
      }
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error(t.admin.supplierActions.errorReadingFile));
    reader.readAsDataURL(file);
  });
}

/** Something to apply: no errors and at least one line or shipping change. */
export function distintaHasChanges(preview: DistintaImportPreview): boolean {
  return preview.errors.length === 0 && (preview.corrections.length > 0 || preview.shippingChanges.length > 0);
}

/** The total the sheet moves on the members' costs (positive: they pay more). */
export function distintaTotalDelta(preview: DistintaImportPreview): number {
  const lines = preview.corrections.reduce((s, c) => s + c.delta, 0);
  const shipping = preview.shippingChanges.reduce((s, c) => s + (c.newShipping - c.oldShipping), 0);
  return Math.round((lines + shipping) * 100) / 100;
}

export function DistintaPreviewPanel({ preview }: { preview: DistintaImportPreview }) {
  const sa = t.admin.supplierActions;
  return (
    <div className="space-y-3">
      {preview.errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-danger-bg p-3 text-[12px] text-destructive">
          <div className="mb-1 font-bold">{sa.errorsTitle}</div>
          <ul className="list-disc pl-4">
            {preview.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <PreviewSection
        title={sa.previewCorrections}
        empty={sa.noCorrections}
        rows={preview.corrections.map((c) => ({
          key: c.orderLineId,
          left: `${c.memberName} · ${c.productName}`,
          oldVal: c.oldTotal,
          newVal: c.newTotal,
          delta: c.delta,
        }))}
      />

      <PreviewSection
        title={sa.previewShipping}
        empty={sa.noShippingChanges}
        rows={preview.shippingChanges.map((s) => ({
          key: s.memberId,
          left: s.memberName,
          oldVal: s.oldShipping,
          newVal: s.newShipping,
          delta: s.newShipping - s.oldShipping,
        }))}
      />

      {preview.errors.length === 0 && preview.corrections.length === 0 && preview.shippingChanges.length === 0 && (
        <p role="status" className="rounded-lg border border-border bg-background p-3 text-[12px] text-foreground">
          {preview.matched.lines === 0
            ? sa.nothingMatched
            : sa.nothingChanged(preview.matched.products, preview.matched.members)}
        </p>
      )}

      {preview.warnings.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary-bg p-3 text-[12px] text-foreground">
          <div className="mb-1 font-bold text-primary-text">{sa.warningsTitle}</div>
          <ul className="list-disc pl-4">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreviewSection({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ key: string; left: string; oldVal: number; newVal: number; delta: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-tint/[0.02] px-3 py-1.5 text-label font-bold text-foreground">
        {title} <span className="font-normal text-secondary-foreground">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-label text-secondary-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className="truncate pr-2 text-foreground">{r.left}</span>
              <span className="shrink-0 tabular-nums text-label">
                <span className="text-muted-foreground line-through">{formatEur(r.oldVal)}</span>
                <span className="mx-1 text-secondary-foreground">→</span>
                <span className="font-bold text-foreground">{formatEur(r.newVal)}</span>
                <span
                  className={`ml-2 ${r.delta > 0 ? "text-destructive" : r.delta < 0 ? "text-accent-text" : "text-secondary-foreground"}`}
                >
                  ({r.delta > 0 ? "+" : r.delta < 0 ? "-" : ""}
                  {formatEur(r.delta)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  adminApplyDistintaImport,
  adminPreviewDistintaImport,
} from "@/lib/actions/admin";
import type { DistintaImportPreview } from "@/lib/csv/distinta-parser";
import { formatEur } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

// Two-step modal: (1) upload the .xlsx the supplier returned and call
// adminPreviewDistintaImport to get a diff, (2) review the diff and call
// adminApplyDistintaImport to commit it.

export function DistintaModal({
  cycleId,
  cycleTitle,
  onClose,
  onApplied,
}: {
  cycleId: string;
  cycleTitle: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<DistintaImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [applying, startApply] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        toast.error("Impossibile leggere il file");
        return;
      }
      // result is "data:...;base64,XXXX" — strip the prefix.
      const idx = result.indexOf(",");
      setFileBase64(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => toast.error("Errore lettura file");
    reader.readAsDataURL(file);
  }, []);

  function handlePreview() {
    if (!fileBase64) return;
    startPreview(async () => {
      const r = await adminPreviewDistintaImport({ cycleId, fileBase64 });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPreview(r.preview);
      if (r.preview.errors.length > 0) {
        toast.error(r.preview.errors[0]);
      }
    });
  }

  function handleApply() {
    if (!fileBase64 || !preview) return;
    if (preview.errors.length > 0) return;
    if (preview.corrections.length === 0 && preview.shippingChanges.length === 0) {
      toast.error("Nessuna modifica da applicare");
      return;
    }
    startApply(async () => {
      const r = await adminApplyDistintaImport({ cycleId, fileBase64 });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const parts: string[] = [];
      if (r.corrections > 0) parts.push(`${r.corrections} rettifiche`);
      if (r.shippingChanges > 0) parts.push(`${r.shippingChanges} spedizioni`);
      toast.success(
        `Distinta applicata: ${parts.join(", ")} — ${r.affectedMembers} soci aggiornati`,
      );
      onApplied();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-2xl bg-pm-warm-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-pm-border p-5">
          <div>
            <h3 className="text-[16px] font-black text-pm-near-black">
              Carica distinta fornitore
            </h3>
            <p className="text-[12px] text-pm-gray">{cycleTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-pm-border p-2 text-pm-gray hover:bg-pm-gray-light"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Step 1 — file picker */}
          <section className="space-y-2">
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-pm-gray">
              1. Seleziona il file .xlsx restituito dal fornitore
            </h4>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFileChange}
              className="block w-full cursor-pointer rounded-xl border border-dashed border-pm-orange/40 bg-white px-3 py-2 text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-pm-orange file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white"
            />
            {fileName && (
              <p className="text-[11px] text-pm-gray">
                File: <span className="font-mono text-pm-near-black">{fileName}</span>
              </p>
            )}
            <button
              onClick={handlePreview}
              disabled={!fileBase64 || previewing}
              className="w-full rounded-xl bg-pm-orange py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {previewing ? "Lettura in corso…" : "Anteprima modifiche"}
            </button>
          </section>

          {/* Step 2 — preview */}
          {preview && (
            <section className="space-y-3">
              <h4 className="text-[12px] font-bold uppercase tracking-wide text-pm-gray">
                2. Anteprima modifiche
              </h4>

              {preview.errors.length > 0 && (
                <div className="rounded-lg border border-pm-red/30 bg-pm-red-light p-3 text-[12px] text-pm-red">
                  <div className="mb-1 font-bold">Errori — niente verrà salvato:</div>
                  <ul className="list-disc pl-4">
                    {preview.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <PreviewSection
                title="Rettifiche righe"
                empty="Nessuna riga modificata."
                rows={preview.corrections.map((c) => ({
                  key: c.orderLineId,
                  left: `${c.memberName} · ${c.productName}`,
                  oldVal: c.oldTotal,
                  newVal: c.newTotal,
                  delta: c.delta,
                }))}
              />

              <PreviewSection
                title="Spedizione per socio"
                empty="Nessuna modifica spedizione."
                rows={preview.shippingChanges.map((s) => ({
                  key: s.memberId,
                  left: s.memberName,
                  oldVal: s.oldShipping,
                  newVal: s.newShipping,
                  delta: s.newShipping - s.oldShipping,
                }))}
              />

              {preview.warnings.length > 0 && (
                <div className="rounded-lg border border-pm-orange/30 bg-pm-orange-light p-3 text-[12px] text-pm-near-black">
                  <div className="mb-1 font-bold text-pm-orange">Avvisi</div>
                  <ul className="list-disc pl-4">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-pm-border p-4">
          <button
            onClick={handleApply}
            disabled={
              !preview ||
              preview.errors.length > 0 ||
              (preview.corrections.length === 0 && preview.shippingChanges.length === 0) ||
              applying
            }
            className="w-full rounded-xl bg-pm-near-black py-3 text-[14px] font-bold text-white shadow-lg active:scale-95 disabled:opacity-40"
          >
            {applying ? "Applicazione in corso…" : "Applica modifiche"}
          </button>
        </div>
      </div>
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
    <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
      <div className="border-b border-pm-border bg-black/[0.02] px-3 py-1.5 text-[11px] font-bold text-pm-near-black">
        {title} <span className="font-normal text-pm-gray">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-pm-gray">{empty}</div>
      ) : (
        <ul className="divide-y divide-pm-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className="truncate pr-2 text-pm-near-black">{r.left}</span>
              <span className="shrink-0 font-mono text-[11px]">
                <span className="text-pm-gray-light line-through">{formatEur(r.oldVal)}</span>
                <span className="mx-1 text-pm-gray">→</span>
                <span className="font-bold text-pm-near-black">{formatEur(r.newVal)}</span>
                <span
                  className={`ml-2 ${r.delta > 0 ? "text-pm-red" : r.delta < 0 ? "text-pm-teal" : "text-pm-gray"}`}
                >
                  ({r.delta > 0 ? "+" : ""}
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

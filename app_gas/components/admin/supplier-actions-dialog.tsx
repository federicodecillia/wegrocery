"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  adminApplyDistintaImport,
  adminBuildSupplierDistinta,
  adminGetSupplierEmailDefaults,
  adminPreviewDistintaImport,
  adminSendSupplierEmail,
} from "@/lib/actions/admin";
import type { DistintaImportPreview } from "@/lib/csv/distinta-parser";
import { formatEur } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

// Single hub dialog for every supplier action on a closed cycle:
//   1. 📥 Scarica riepilogo ordini (.xlsx download)
//   2. 📧 Invia per email al fornitore (4-field form)
//   3. 📤 Carica distinta compilata (upload → preview → apply)
//
// The three sections are always visible — the admin can use any of them
// in any order without closing the dialog. We trigger downloads/sends
// directly from each section; only "Carica distinta" has multi-step
// internal state (upload → preview → apply).

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function SupplierActionsDialog({
  open,
  onOpenChange,
  cycleId,
  cycleTitle,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cycleId: string;
  cycleTitle: string;
  // Called after a destructive change (mail sent or distinta applied) so the
  // parent can revalidate any cached cycle data it's showing.
  onChanged?: () => void;
}) {
  // ── Email defaults / form state ────────────────────────────────────────
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");

  // ── Action transitions ─────────────────────────────────────────────────
  const [downloading, startDownload] = useTransition();
  const [sending, startSending] = useTransition();

  // ── Upload state ───────────────────────────────────────────────────────
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<DistintaImportPreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [applying, startApply] = useTransition();

  useEffect(() => {
    if (!open) return;
    // Reset on every open so a previously-loaded preview doesn't carry over.
    setFileName(null);
    setFileBase64(null);
    setPreview(null);
    setDefaultsLoading(true);
    adminGetSupplierEmailDefaults(cycleId).then((r) => {
      setDefaultsLoading(false);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setSupplierName(r.supplierName);
      setTo(r.to);
      setFrom(r.from);
      setCc(r.cc.join(", "));
      setSubject(r.subject);
    });
  }, [open, cycleId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  function handleDownload() {
    startDownload(async () => {
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
      toast.success(t.admin.supplierActions.downloadSuccess);
    });
  }

  function handleSendMail() {
    const ccList = cc.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!to.trim()) {
      toast.error(t.admin.supplierActions.recipientRequired);
      return;
    }
    if (!subject.trim()) {
      toast.error(t.admin.supplierActions.subjectRequired);
      return;
    }
    startSending(async () => {
      const r = await adminSendSupplierEmail(cycleId, {
        to: to.trim(),
        from: from.trim() || undefined,
        cc: ccList,
        subject: subject.trim(),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(t.admin.supplierActions.mailSent(r.recipient));
      onChanged?.();
    });
  }

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        toast.error(t.admin.supplierActions.cannotReadFile);
        return;
      }
      const idx = result.indexOf(",");
      setFileBase64(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => toast.error(t.admin.supplierActions.errorReadingFile);
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
      if (r.preview.errors.length > 0) toast.error(r.preview.errors[0]);
    });
  }

  function handleApply() {
    if (!fileBase64 || !preview) return;
    if (preview.errors.length > 0) return;
    if (preview.corrections.length === 0 && preview.shippingChanges.length === 0) {
      toast.error(t.admin.supplierActions.nothingToApply);
      return;
    }
    startApply(async () => {
      const r = await adminApplyDistintaImport({ cycleId, fileBase64 });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(t.admin.supplierActions.appliedSuccess(r.corrections, r.shippingChanges, r.affectedMembers));
      setPreview(null);
      setFileBase64(null);
      setFileName(null);
      onChanged?.();
    });
  }

  const labelCls = "block text-[10px] font-semibold uppercase tracking-wide text-brand-gray";
  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-[12px] font-mono text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-orange/30 disabled:bg-brand-warm-white";
  const sectionTitleCls = "flex items-center gap-2 text-[13px] font-bold text-brand-near-black";
  const sectionDescCls = "mb-2 text-[11px] text-brand-gray";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[4px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[151] flex max-h-[92vh] w-[94%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-[0_8px_32px_rgba(45,43,41,0.15)] data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-center justify-between border-b border-brand-border p-5">
            <div>
              <Dialog.Title className="text-[15px] font-bold text-brand-near-black">
                {t.admin.supplierActions.dialogTitle(supplierName)}
              </Dialog.Title>
              <p className="mt-0.5 text-[11px] text-brand-gray">{t.admin.supplierActions.cycleLabel(cycleTitle)}</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-brand-border p-2 text-brand-gray hover:bg-brand-gray-light"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* ── Scarica ────────────────────────────────────── */}
            <section>
              <div className={sectionTitleCls}>{t.admin.supplierActions.downloadSection}</div>
              <p className={sectionDescCls}>
                {t.admin.supplierActions.downloadDescription}
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full rounded-xl border border-brand-teal/30 bg-brand-teal-light py-2.5 text-[13px] font-bold text-brand-teal active:scale-95 disabled:opacity-50"
              >
                {downloading ? t.admin.supplierActions.downloading : t.admin.supplierActions.downloadButton}
              </button>
            </section>

            <div className="border-t border-brand-border" />

            {/* ── Invia mail ────────────────────────────────── */}
            <section>
              <div className={sectionTitleCls}>{t.admin.supplierActions.emailSection}</div>
              <p className={sectionDescCls}>
                {t.admin.supplierActions.emailDescription}
              </p>
              {defaultsLoading ? (
                <div className="py-4 text-center text-[12px] text-brand-gray">{t.admin.supplierActions.loadingDefaults}</div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className={labelCls}>{t.admin.supplierActions.recipientLabel}</label>
                    <input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      disabled={sending}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t.admin.supplierActions.senderLabel}</label>
                    <input
                      type="email"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      disabled={sending}
                      placeholder={t.admin.supplierActions.senderPlaceholder}
                      className={inputCls}
                    />
                    <p className="mt-0.5 text-[10px] text-brand-gray-light">
                      {t.admin.supplierActions.senderHint}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>{t.admin.supplierActions.ccLabel}</label>
                    <textarea
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      disabled={sending}
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t.admin.supplierActions.subjectLabel}</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      disabled={sending}
                      className={inputCls}
                    />
                  </div>
                  <button
                    onClick={handleSendMail}
                    disabled={defaultsLoading || sending}
                    className="w-full rounded-xl bg-brand-near-black py-2.5 text-[13px] font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {sending ? t.admin.common.sending : t.admin.supplierActions.sendButton}
                  </button>
                </div>
              )}
            </section>

            <div className="border-t border-brand-border" />

            {/* ── Carica distinta ───────────────────────────── */}
            <section>
              <div className={sectionTitleCls}>{t.admin.supplierActions.uploadSection}</div>
              <p className={sectionDescCls}>
                {t.admin.supplierActions.uploadDescription}
              </p>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFileChange}
                className="block w-full cursor-pointer rounded-xl border border-dashed border-brand-orange/40 bg-white px-3 py-2 text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-orange file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white"
              />
              {fileName && (
                <p className="mt-1 text-[11px] text-brand-gray">
                  {t.admin.importWizard.fileInfo(fileName)}
                </p>
              )}
              <button
                onClick={handlePreview}
                disabled={!fileBase64 || previewing}
                className="mt-2 w-full rounded-xl bg-brand-orange py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {previewing ? t.admin.supplierActions.previewing : t.admin.supplierActions.previewButton}
              </button>

              {preview && (
                <div className="mt-3 space-y-3">
                  {preview.errors.length > 0 && (
                    <div className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[12px] text-brand-red">
                      <div className="mb-1 font-bold">{t.admin.supplierActions.errorsTitle}</div>
                      <ul className="list-disc pl-4">
                        {preview.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <PreviewSection
                    title={t.admin.supplierActions.previewCorrections}
                    empty={t.admin.supplierActions.noCorrections}
                    rows={preview.corrections.map((c) => ({
                      key: c.orderLineId,
                      left: `${c.memberName} · ${c.productName}`,
                      oldVal: c.oldTotal,
                      newVal: c.newTotal,
                      delta: c.delta,
                    }))}
                  />

                  <PreviewSection
                    title={t.admin.supplierActions.previewShipping}
                    empty={t.admin.supplierActions.noShippingChanges}
                    rows={preview.shippingChanges.map((s) => ({
                      key: s.memberId,
                      left: s.memberName,
                      oldVal: s.oldShipping,
                      newVal: s.newShipping,
                      delta: s.newShipping - s.oldShipping,
                    }))}
                  />

                  {preview.warnings.length > 0 && (
                    <div className="rounded-lg border border-brand-orange/30 bg-brand-orange-light p-3 text-[12px] text-brand-near-black">
                      <div className="mb-1 font-bold text-brand-orange">{t.admin.supplierActions.warningsTitle}</div>
                      <ul className="list-disc pl-4">
                        {preview.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={handleApply}
                    disabled={
                      preview.errors.length > 0 ||
                      (preview.corrections.length === 0 && preview.shippingChanges.length === 0) ||
                      applying
                    }
                    className="w-full rounded-xl bg-brand-near-black py-2.5 text-[13px] font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {applying ? t.admin.supplierActions.applying : t.admin.supplierActions.applyButton}
                  </button>
                </div>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <div className="overflow-hidden rounded-lg border border-brand-border bg-white">
      <div className="border-b border-brand-border bg-black/[0.02] px-3 py-1.5 text-[11px] font-bold text-brand-near-black">
        {title} <span className="font-normal text-brand-gray">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-brand-gray">{empty}</div>
      ) : (
        <ul className="divide-y divide-brand-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className="truncate pr-2 text-brand-near-black">{r.left}</span>
              <span className="shrink-0 font-mono text-[11px]">
                <span className="text-brand-gray-light line-through">{formatEur(r.oldVal)}</span>
                <span className="mx-1 text-brand-gray">→</span>
                <span className="font-bold text-brand-near-black">{formatEur(r.newVal)}</span>
                <span
                  className={`ml-2 ${r.delta > 0 ? "text-brand-red" : r.delta < 0 ? "text-brand-teal" : "text-brand-gray"}`}
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

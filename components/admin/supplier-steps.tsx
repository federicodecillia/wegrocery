"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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

// Admin → Ciclo → Fornitore: every supplier action on a closed cycle, as three
// numbered steps on the page (before, a sheet behind the "🤝 Fornitore" button):
//   1. Scarica la distinta (.xlsx download)
//   2. Inviala per email al fornitore (4-field form)
//   3. Carica la distinta compilata (upload → preview → apply)
//
// The numbers say the usual order; each step works on its own, in any order.
// Only step 3 has multi-step internal state (upload → preview → apply).

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function SupplierSteps({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  // After a mail is sent or a distinta applied, the server data on the page
  // (totals, Conti) is read again.
  const onChanged = () => router.refresh();
  // ── Email defaults / form state ────────────────────────────────────────
  const [defaultsLoading, setDefaultsLoading] = useState(false);
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
    setDefaultsLoading(true);
    adminGetSupplierEmailDefaults(cycleId).then((r) => {
      setDefaultsLoading(false);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setTo(r.to);
      setFrom(r.from);
      setCc(r.cc.join(", "));
      setSubject(r.subject);
    });
  }, [cycleId]);

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
      onChanged();
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
      const r = await adminPreviewDistintaImport({ cycleId, fileBase64, fileName: fileName ?? undefined });
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
      const r = await adminApplyDistintaImport({ cycleId, fileBase64, fileName: fileName ?? undefined });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(t.admin.supplierActions.appliedSuccess(r.corrections, r.shippingChanges, r.affectedMembers));
      setPreview(null);
      setFileBase64(null);
      setFileName(null);
      onChanged();
    });
  }

  const labelCls = "block text-label font-semibold uppercase tracking-wide text-brand-gray";
  const inputCls =
    "w-full rounded-lg border border-brand-border bg-white min-h-11 px-3 py-2 text-[14px] font-mono text-brand-near-black disabled:bg-brand-warm-white";
  const sa = t.admin.supplierActions;

  return (
    <ol className="space-y-4">
      <Step n={1} title={sa.downloadSection} description={sa.downloadDescription}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="min-h-11 w-full rounded-xl px-5 sm:w-auto border border-accent/30 bg-accent-soft py-2.5 text-[13px] font-bold text-accent-text active:scale-95 disabled:opacity-50"
        >
          {downloading ? t.admin.supplierActions.downloading : t.admin.supplierActions.downloadButton}
        </button>
      </Step>

      <Step n={2} title={sa.emailSection} description={sa.emailDescription}>
        {defaultsLoading ? (
          <div className="py-4 text-center text-[12px] text-brand-gray">{t.admin.supplierActions.loadingDefaults}</div>
        ) : (
          <div className="space-y-2.5">
            <div>
              <label htmlFor="sup-mail-to" className={labelCls}>{t.admin.supplierActions.recipientLabel}</label>
              <input
                id="sup-mail-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={sending}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="sup-mail-from" className={labelCls}>{t.admin.supplierActions.senderLabel}</label>
              <input
                id="sup-mail-from"
                type="email"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={sending}
                placeholder={t.admin.supplierActions.senderPlaceholder}
                className={inputCls}
              />
              <p className="mt-0.5 text-label text-muted">
                {t.admin.supplierActions.senderHint}
              </p>
            </div>
            <div>
              <label htmlFor="sup-mail-cc" className={labelCls}>{t.admin.supplierActions.ccLabel}</label>
              <textarea
                id="sup-mail-cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={sending}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="sup-mail-subject" className={labelCls}>{t.admin.supplierActions.subjectLabel}</label>
              <input
                id="sup-mail-subject"
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
              className="min-h-11 w-full rounded-xl px-5 sm:w-auto bg-brand-near-black py-2.5 text-[13px] font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
            >
              {sending ? t.admin.common.sending : t.admin.supplierActions.sendButton}
            </button>
          </div>
        )}
      </Step>

      <Step n={3} title={sa.uploadSection} description={sa.uploadDescription}>
        <input
          type="file"
          aria-label={t.admin.supplierActions.uploadSection}
          accept=".xlsx,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv"
          onChange={onFileChange}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-primary/40 bg-white px-3 py-2 text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label file:font-bold file:text-on-primary"
        />
        {fileName && (
          <p className="mt-1 text-label text-brand-gray">
            {t.admin.importWizard.fileInfo(fileName)}
          </p>
        )}
        <button
          onClick={handlePreview}
          disabled={!fileBase64 || previewing}
          className="mt-2 min-h-11 w-full rounded-xl px-5 sm:w-auto bg-primary py-2.5 text-[13px] font-bold text-on-primary disabled:opacity-50"
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
              <div className="rounded-lg border border-primary/30 bg-primary-soft p-3 text-[12px] text-brand-near-black">
                <div className="mb-1 font-bold text-primary-text">{t.admin.supplierActions.warningsTitle}</div>
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
              className="min-h-11 w-full rounded-xl px-5 sm:w-auto bg-brand-near-black py-2.5 text-[13px] font-bold text-white shadow-lg active:scale-95 disabled:opacity-50"
            >
              {applying ? t.admin.supplierActions.applying : t.admin.supplierActions.applyButton}
            </button>
          </div>
        )}
      </Step>
    </ol>
  );
}

function Step({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-brand-border bg-white p-4">
      <h3 className="flex items-center gap-2 text-[14px] font-bold text-brand-near-black">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-label font-bold text-on-primary">
          {n}
        </span>
        <span>
          <span className="sr-only">{t.admin.supplierActions.stepLabel(n)}: </span>
          {title}
        </span>
      </h3>
      <p className="mt-1 mb-3 max-w-prose text-[13px] text-brand-gray">{description}</p>
      {children}
    </li>
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
      <div className="border-b border-brand-border bg-black/[0.02] px-3 py-1.5 text-label font-bold text-brand-near-black">
        {title} <span className="font-normal text-brand-gray">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-label text-brand-gray">{empty}</div>
      ) : (
        <ul className="divide-y divide-brand-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className="truncate pr-2 text-brand-near-black">{r.left}</span>
              <span className="shrink-0 font-mono text-label">
                <span className="text-muted line-through">{formatEur(r.oldVal)}</span>
                <span className="mx-1 text-brand-gray">→</span>
                <span className="font-bold text-brand-near-black">{formatEur(r.newVal)}</span>
                <span
                  className={`ml-2 ${r.delta > 0 ? "text-brand-red" : r.delta < 0 ? "text-accent-text" : "text-brand-gray"}`}
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

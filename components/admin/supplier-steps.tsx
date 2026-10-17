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
import { DISTINTA_ACCEPT, DistintaPreviewPanel, readFileAsBase64 } from "@/components/admin/distinta-preview";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

// Admin → Ciclo → Fornitore: every supplier action on a closed cycle (steps 1
// and 2 also on an open cycle past its order deadline), as three
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

export function SupplierSteps({ cycleId, cycleOpen = false }: { cycleId: string; cycleOpen?: boolean }) {
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
    readFileAsBase64(file).then(setFileBase64, (err: Error) => toast.error(err.message));
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

  const labelCls = "block text-label font-semibold uppercase tracking-wide text-secondary-foreground";
  const inputCls =
    "w-full rounded-lg border border-border bg-card min-h-11 px-3 py-2 text-[14px] tabular-nums text-foreground disabled:bg-background";
  const sa = t.admin.supplierActions;

  return (
    <ol className="space-y-4">
      <Step n={1} title={sa.downloadSection} description={sa.downloadDescription}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="min-h-11 w-full rounded-xl px-5 sm:w-auto border border-accent/30 bg-accent-bg py-2.5 text-[13px] font-bold text-accent-text active:scale-95 disabled:opacity-50"
        >
          {downloading ? t.admin.supplierActions.downloading : t.admin.supplierActions.downloadButton}
        </button>
      </Step>

      <Step n={2} title={sa.emailSection} description={sa.emailDescription}>
        {defaultsLoading ? (
          <div className="py-4 text-center text-[12px] text-secondary-foreground">{t.admin.supplierActions.loadingDefaults}</div>
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
              <p className="mt-0.5 text-label text-muted-foreground">
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
              className="min-h-11 w-full rounded-xl px-5 sm:w-auto bg-inverse py-2.5 text-[13px] font-bold text-inverse-foreground shadow-lg active:scale-95 disabled:opacity-50"
            >
              {sending ? t.admin.common.sending : t.admin.supplierActions.sendButton}
            </button>
          </div>
        )}
      </Step>

      {cycleOpen ? (
        // Open past the deadline: the completed sheet is applied by the close itself.
        <Step n={3} title={sa.uploadSection} description={sa.uploadAtClose} />
      ) : (
      <Step n={3} title={sa.uploadSection} description={sa.uploadDescription}>
        <input
          type="file"
          aria-label={t.admin.supplierActions.uploadSection}
          accept={DISTINTA_ACCEPT}
          onChange={onFileChange}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-primary/40 bg-card px-3 py-2 text-[12px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label file:font-bold file:text-primary-foreground"
        />
        {fileName && (
          <p className="mt-1 text-label text-secondary-foreground">
            {t.admin.importWizard.fileInfo(fileName)}
          </p>
        )}
        <button
          onClick={handlePreview}
          disabled={!fileBase64 || previewing}
          className="mt-2 min-h-11 w-full rounded-xl px-5 sm:w-auto bg-primary py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {previewing ? t.admin.supplierActions.previewing : t.admin.supplierActions.previewButton}
        </button>

        {preview && (
          <div className="mt-3 space-y-3">
            <DistintaPreviewPanel preview={preview} />

            <button
              onClick={handleApply}
              disabled={
                preview.errors.length > 0 ||
                (preview.corrections.length === 0 && preview.shippingChanges.length === 0) ||
                applying
              }
              className="min-h-11 w-full rounded-xl px-5 sm:w-auto bg-inverse py-2.5 text-[13px] font-bold text-inverse-foreground shadow-lg active:scale-95 disabled:opacity-50"
            >
              {applying ? t.admin.supplierActions.applying : t.admin.supplierActions.applyButton}
            </button>
          </div>
        )}
      </Step>
      )}
    </ol>
  );
}

function Step({ n, title, description, children }: { n: number; title: string; description: string; children?: ReactNode }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-[14px] font-bold text-foreground">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-label font-bold text-primary-foreground">
          {n}
        </span>
        <span>
          <span className="sr-only">{t.admin.supplierActions.stepLabel(n)}: </span>
          {title}
        </span>
      </h3>
      <p className={`mt-1 max-w-prose text-[13px] text-secondary-foreground ${children ? "mb-3" : ""}`}>{description}</p>
      {children}
    </li>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import {
  adminInspectSupplierListing,
  adminApplySupplierListingImport,
  type WizardInspectionResult,
  type WizardApplyInput,
} from "@/lib/actions/admin-products";
import {
  REQUIRED_FIELDS,
  TARGET_FIELDS,
  TARGET_LABEL,
  type TargetField,
} from "@/lib/csv/header-heuristics";
import { getProductEmojiOrNull, guessProductCategory } from "@/lib/utils";
import { t } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  // When provided, the wizard offers an "add to this cycle" toggle defaulted
  // to ON. When null/undefined, the toggle is hidden (catalogue-only import).
  cycleId?: string | null;
  cycleTitle?: string | null;
};

type Step = 1 | 2 | 3;

export function ImportListingWizard({ open, onClose, cycleId, cycleTitle }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [pending, startTransition] = useTransition();
  const [filename, setFilename] = useState("");
  const [inspection, setInspection] = useState<WizardInspectionResult | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">("existing");
  const [existingSupplierId, setExistingSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [mapping, setMapping] = useState<Partial<Record<TargetField, number>>>({});
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [emojiOverrides, setEmojiOverrides] = useState<Record<number, string>>({});
  const [addToCycle, setAddToCycle] = useState<boolean>(!!cycleId);
  const [updatePriceOnDup, setUpdatePriceOnDup] = useState<boolean>(true);

  useEffect(() => {
    if (!open) {
      // reset on close
      setStep(1);
      setFilename("");
      setInspection(null);
      setSheetIdx(0);
      setSupplierMode("existing");
      setExistingSupplierId("");
      setNewSupplierName("");
      setMapping({});
      setSelectedIndexes(new Set());
      setEmojiOverrides({});
      setAddToCycle(!!cycleId);
      setUpdatePriceOnDup(true);
    }
  }, [open, cycleId]);

  const sheet = inspection?.inspection.sheets[sheetIdx] ?? null;

  // When the sheet selection changes, seed mapping + selection from server suggestion.
  useEffect(() => {
    if (!inspection || !sheet) return;
    setMapping(inspection.suggestedMappings[sheetIdx] ?? {});
    setSelectedIndexes(new Set(sheet.rows.map((_, i) => i)));
    setEmojiOverrides({});
  }, [inspection, sheetIdx, sheet]);

  // When the inspection arrives, preselect the suggested supplier.
  useEffect(() => {
    if (!inspection) return;
    if (inspection.suggestedSupplierId) {
      setSupplierMode("existing");
      setExistingSupplierId(inspection.suggestedSupplierId);
    } else if (inspection.suppliers.length === 0) {
      setSupplierMode("new");
    }
  }, [inspection]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        toast.error(t.admin.importWizard.cannotReadFile);
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      startTransition(async () => {
        const res = await adminInspectSupplierListing(file.name, base64);
        if ("error" in res && res.error) {
          toast.error(res.error);
          return;
        }
        if (!res.data) {
          toast.error(t.admin.importWizard.emptyResponse);
          return;
        }
        setFilename(file.name);
        setInspection(res.data);
        setSheetIdx(0);
      });
    };
    reader.readAsDataURL(file);
  }

  const supplierResolved =
    supplierMode === "existing"
      ? !!existingSupplierId
      : newSupplierName.trim().length > 0;

  const requiredMapped = REQUIRED_FIELDS.every((f) => mapping[f] !== undefined);

  function buildApplyInput(): WizardApplyInput | null {
    if (!sheet) return null;
    return {
      supplier:
        supplierMode === "existing"
          ? { existingId: existingSupplierId }
          : { newName: newSupplierName.trim() },
      columns: sheet.columns,
      rows: sheet.rows,
      mapping,
      emojiOverrides,
      selectedIndexes: [...selectedIndexes].sort((a, b) => a - b),
      updatePriceOnDuplicate: updatePriceOnDup,
      cycleId: addToCycle && cycleId ? cycleId : null,
    };
  }

  function handleApply() {
    const input = buildApplyInput();
    if (!input) return;
    startTransition(async () => {
      const res = await adminApplySupplierListingImport(input);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const d = res.data!;
      const bits = [
        d.added ? t.admin.importWizard.importAdded(d.added) : null,
        d.updated ? t.admin.importWizard.importUpdated(d.updated) : null,
        d.skipped ? t.admin.importWizard.importSkipped(d.skipped) : null,
        d.invalid ? t.admin.importWizard.importInvalid(d.invalid) : null,
        d.addedToCycle ? t.admin.importWizard.importAddedToCycle(d.addedToCycle) : null,
      ].filter(Boolean);
      toast.success(t.admin.importWizard.importSuccess(bits.join(", ")));
      onClose();
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col rounded-2xl bg-brand-warm-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-brand-border p-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand-orange">
              {cycleTitle ? `${cycleTitle} · ` : ""}{t.admin.cycle.importListing} · {t.admin.importWizard.stepIndicator(step, 3)}
            </div>
            <h3 className="mt-1 text-[16px] font-black text-brand-near-black">
              {step === 1 && t.admin.importWizard.step1Title}
              {step === 2 && t.admin.importWizard.step2Title}
              {step === 3 && t.admin.importWizard.step3Title}
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-brand-gray">
              {step === 1 && t.admin.importWizard.step1Description}
              {step === 2 && t.admin.importWizard.step2Description}
              {step === 3 && t.admin.importWizard.step3Description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-brand-border p-2 text-brand-gray"
            aria-label={t.admin.common.close}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <Step1Upload
              filename={filename}
              pending={pending}
              onFile={handleFile}
              inspection={inspection}
              sheetIdx={sheetIdx}
              setSheetIdx={setSheetIdx}
              supplierMode={supplierMode}
              setSupplierMode={setSupplierMode}
              existingSupplierId={existingSupplierId}
              setExistingSupplierId={setExistingSupplierId}
              newSupplierName={newSupplierName}
              setNewSupplierName={setNewSupplierName}
            />
          )}
          {step === 2 && sheet && (
            <Step2Mapping sheet={sheet} mapping={mapping} setMapping={setMapping} />
          )}
          {step === 3 && sheet && (
            <Step3Review
              sheet={sheet}
              mapping={mapping}
              selectedIndexes={selectedIndexes}
              setSelectedIndexes={setSelectedIndexes}
              emojiOverrides={emojiOverrides}
              setEmojiOverrides={setEmojiOverrides}
              addToCycle={addToCycle}
              setAddToCycle={setAddToCycle}
              updatePriceOnDup={updatePriceOnDup}
              setUpdatePriceOnDup={setUpdatePriceOnDup}
              hasCycle={!!cycleId}
            />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-brand-border p-4">
          <div className="text-[11px] text-brand-gray">
            {step === 1 && filename && t.admin.importWizard.fileInfo(filename)}
            {step === 2 && !requiredMapped && (
              <span className="text-brand-red">{t.admin.importWizard.requiredMissingWarning}</span>
            )}
            {step === 3 && (
              <>{t.admin.importWizard.selectedCount(selectedIndexes.size, sheet?.rows.length ?? 0)}</>
            )}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
                {t.admin.importWizard.back}
              </Button>
            )}
            {step < 3 && (
              <Button
                variant="primary"
                disabled={
                  pending ||
                  (step === 1 && (!inspection || !supplierResolved)) ||
                  (step === 2 && !requiredMapped)
                }
                onClick={() => setStep((s) => (s + 1) as Step)}
              >
                {t.admin.importWizard.next}
              </Button>
            )}
            {step === 3 && (
              <Button
                variant="primary"
                disabled={pending || selectedIndexes.size === 0 || !supplierResolved}
                onClick={handleApply}
              >
                {pending ? t.admin.importWizard.importing : t.admin.importWizard.import}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 1
// ────────────────────────────────────────────────────────────────────────────

function Step1Upload({
  filename,
  pending,
  onFile,
  inspection,
  sheetIdx,
  setSheetIdx,
  supplierMode,
  setSupplierMode,
  existingSupplierId,
  setExistingSupplierId,
  newSupplierName,
  setNewSupplierName,
}: {
  filename: string;
  pending: boolean;
  onFile: (f: File) => void;
  inspection: WizardInspectionResult | null;
  sheetIdx: number;
  setSheetIdx: (i: number) => void;
  supplierMode: "existing" | "new";
  setSupplierMode: (m: "existing" | "new") => void;
  existingSupplierId: string;
  setExistingSupplierId: (s: string) => void;
  newSupplierName: string;
  setNewSupplierName: (s: string) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="block rounded-xl border-2 border-dashed border-brand-border bg-white p-6 text-center">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <div className="text-[13px] font-semibold text-brand-near-black">
          {pending ? t.admin.importWizard.readingFile : filename ? t.admin.importWizard.fileSelected(filename) : t.admin.importWizard.fileDropLabel}
        </div>
        <div className="mt-1 text-[11px] text-brand-gray">
          {t.admin.importWizard.fileDropHint}
        </div>
      </label>

      {inspection && inspection.inspection.sheets.length > 1 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-gray">
            {t.admin.importWizard.sheetLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            {inspection.inspection.sheets.map((s, i) => (
              <button
                key={s.sheetName}
                onClick={() => setSheetIdx(i)}
                className={`rounded-full border px-3 py-1 text-[12px] ${
                  i === sheetIdx
                    ? "border-brand-orange bg-brand-orange-light text-brand-near-black"
                    : "border-brand-border bg-white text-brand-gray"
                }`}
              >
                {s.sheetName} ({s.rows.length})
              </button>
            ))}
          </div>
        </div>
      )}

      {inspection && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-gray">
            {t.admin.importWizard.supplierLabel}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSupplierMode("existing")}
              className={`flex-1 rounded-lg border px-3 py-2 text-[12px] ${
                supplierMode === "existing"
                  ? "border-brand-orange bg-brand-orange-light"
                  : "border-brand-border bg-white"
              }`}
            >
              {t.admin.importWizard.supplierExisting}
            </button>
            <button
              onClick={() => setSupplierMode("new")}
              className={`flex-1 rounded-lg border px-3 py-2 text-[12px] ${
                supplierMode === "new"
                  ? "border-brand-orange bg-brand-orange-light"
                  : "border-brand-border bg-white"
              }`}
            >
              {t.admin.importWizard.supplierNew}
            </button>
          </div>
          {supplierMode === "existing" ? (
            <select
              value={existingSupplierId}
              onChange={(e) => setExistingSupplierId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-[13px]"
            >
              <option value="">{t.admin.importWizard.supplierSelectPlaceholder}</option>
              {inspection.suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder={t.admin.importWizard.supplierNewPlaceholder}
              className="mt-2 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-[13px]"
            />
          )}
          {inspection.inspection.supplierHints.length > 0 && supplierMode === "existing" && (
            <div className="mt-2 text-[11px] text-brand-gray">
              {t.admin.importWizard.supplierSuggestedHint(inspection.inspection.supplierHints[0].text)}
              {inspection.suggestedSupplierId === "" || !inspection.suggestedSupplierId
                ? t.admin.importWizard.supplierNoMatch
                : ""}
            </div>
          )}
        </div>
      )}

      {inspection && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-gray">
            {t.admin.importWizard.previewLabel(inspection.inspection.sheets[sheetIdx]?.rows.length ?? 0)}
          </div>
          <PreviewTable
            columns={inspection.inspection.sheets[sheetIdx]?.columns ?? []}
            rows={(inspection.inspection.sheets[sheetIdx]?.rows ?? []).slice(0, 5)}
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 2
// ────────────────────────────────────────────────────────────────────────────

function Step2Mapping({
  sheet,
  mapping,
  setMapping,
}: {
  sheet: { columns: string[]; rows: string[][] };
  mapping: Partial<Record<TargetField, number>>;
  setMapping: (m: Partial<Record<TargetField, number>>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {TARGET_FIELDS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field);
          const value = mapping[field];
          return (
            <label key={field} className="flex items-center gap-2 rounded-lg border border-brand-border bg-white px-3 py-2 text-[12px]">
              <span className="w-24 shrink-0 font-semibold text-brand-near-black">
                {TARGET_LABEL[field]}
                {required && <span className="text-brand-red"> *</span>}
              </span>
              <select
                value={value === undefined ? "" : String(value)}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = { ...mapping };
                  if (v === "") delete next[field];
                  else next[field] = Number(v);
                  setMapping(next);
                }}
                className="flex-1 rounded border border-brand-border bg-white px-2 py-1 text-[12px]"
              >
                <option value="">(ignora)</option>
                {sheet.columns.map((c, i) => (
                  <option key={i} value={i}>
                    {c || t.admin.importWizard.columnPlaceholder(i + 1)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-gray">
          {t.admin.importWizard.step2PreviewLabel}
        </div>
        <PreviewTable columns={sheet.columns} rows={sheet.rows.slice(0, 5)} highlightMap={mapping} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Step 3
// ────────────────────────────────────────────────────────────────────────────

function Step3Review({
  sheet,
  mapping,
  selectedIndexes,
  setSelectedIndexes,
  emojiOverrides,
  setEmojiOverrides,
  addToCycle,
  setAddToCycle,
  updatePriceOnDup,
  setUpdatePriceOnDup,
  hasCycle,
}: {
  sheet: { columns: string[]; rows: string[][] };
  mapping: Partial<Record<TargetField, number>>;
  selectedIndexes: Set<number>;
  setSelectedIndexes: (s: Set<number>) => void;
  emojiOverrides: Record<number, string>;
  setEmojiOverrides: (m: Record<number, string>) => void;
  addToCycle: boolean;
  setAddToCycle: (b: boolean) => void;
  updatePriceOnDup: boolean;
  setUpdatePriceOnDup: (b: boolean) => void;
  hasCycle: boolean;
}) {
  function cell(rowIdx: number, field: TargetField): string {
    const col = mapping[field];
    if (col === undefined) return "";
    return sheet.rows[rowIdx]?.[col] ?? "";
  }

  function toggle(idx: number) {
    const next = new Set(selectedIndexes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndexes(next);
  }
  function toggleAll() {
    if (selectedIndexes.size === sheet.rows.length) setSelectedIndexes(new Set());
    else setSelectedIndexes(new Set(sheet.rows.map((_, i) => i)));
  }

  const unmatchedEmojiCount = useMemo(
    () =>
      sheet.rows.filter((_, i) => {
        if (!selectedIndexes.has(i)) return false;
        if (emojiOverrides[i]) return false;
        const name = cell(i, "name");
        return name && getProductEmojiOrNull(name) === null;
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet.rows, selectedIndexes, emojiOverrides, mapping],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-orange-light px-3 py-2 text-[12px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={updatePriceOnDup}
            onChange={(e) => setUpdatePriceOnDup(e.target.checked)}
          />
          {t.admin.importWizard.updatePriceOnDup}
        </label>
        {hasCycle && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addToCycle}
              onChange={(e) => setAddToCycle(e.target.checked)}
            />
            {t.admin.importWizard.addToCycle}
          </label>
        )}
        {unmatchedEmojiCount > 0 && (
          <span className="ml-auto text-brand-red">
            {t.admin.importWizard.unmatchedEmojis(unmatchedEmojiCount)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-border bg-white">
        <table className="w-full text-[12px]">
          <thead className="border-b border-brand-border bg-brand-warm-white">
            <tr>
              <th className="p-2 text-left">
                <input
                  type="checkbox"
                  checked={selectedIndexes.size === sheet.rows.length && sheet.rows.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="p-2 text-left">{t.admin.importWizard.colIconHeader}</th>
              <th className="p-2 text-left">{t.admin.importWizard.colNameHeader}</th>
              <th className="p-2 text-left">{t.admin.importWizard.colVariantHeader}</th>
              <th className="p-2 text-left">{t.admin.importWizard.colCategoryHeader}</th>
              <th className="p-2 text-left">{t.admin.importWizard.colFormatHeader}</th>
              <th className="p-2 text-right">{t.admin.importWizard.colPriceHeader}</th>
              <th className="p-2 text-right">{t.admin.importWizard.colPriceKgHeader}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((_, i) => {
              const name = cell(i, "name");
              const auto = name ? getProductEmojiOrNull(name) : null;
              const override = emojiOverrides[i];
              const currentEmoji = override || auto || "🛒";
              const selected = selectedIndexes.has(i);
              const fileCategory = cell(i, "category");
              const guessedCategory = fileCategory || (name ? guessProductCategory(name) : null);
              return (
                <tr key={i} className={`border-b border-brand-border ${selected ? "" : "opacity-40"}`}>
                  <td className="p-2 align-middle">
                    <input type="checkbox" checked={selected} onChange={() => toggle(i)} />
                  </td>
                  <td className="p-2 align-middle">
                    <EmojiPicker
                      name={`emoji_${i}`}
                      value={currentEmoji}
                      onChange={(v) => setEmojiOverrides({ ...emojiOverrides, [i]: v })}
                    />
                    {!override && !auto && (
                      <div className="text-[9px] text-brand-red">{t.admin.importWizard.emojiNotAuto}</div>
                    )}
                  </td>
                  <td className="p-2 align-middle font-semibold">{name || <em className="text-brand-red">{t.admin.importWizard.emptyName}</em>}</td>
                  <td className="p-2 align-middle text-brand-gray">{cell(i, "variant")}</td>
                  <td className="p-2 align-middle text-brand-gray">
                    {guessedCategory ? (
                      <span>
                        {guessedCategory}
                        {!fileCategory && <span className="ml-1 text-[9px] text-brand-orange">{t.admin.importWizard.autoCategory}</span>}
                      </span>
                    ) : (
                      <span className="text-brand-gray-light">—</span>
                    )}
                  </td>
                  <td className="p-2 align-middle text-brand-gray">{cell(i, "format")}</td>
                  <td className="p-2 text-right align-middle font-mono">{cell(i, "unitPrice")}</td>
                  <td className="p-2 text-right align-middle font-mono text-brand-gray">{cell(i, "pricePerKg")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared preview table
// ────────────────────────────────────────────────────────────────────────────

function PreviewTable({
  columns,
  rows,
  highlightMap,
}: {
  columns: string[];
  rows: string[][];
  highlightMap?: Partial<Record<TargetField, number>>;
}) {
  const highlights = useMemo(() => {
    const m = new Map<number, string>();
    if (!highlightMap) return m;
    for (const [k, v] of Object.entries(highlightMap)) {
      if (v !== undefined) m.set(v as number, k);
    }
    return m;
  }, [highlightMap]);

  if (!columns.length) return <div className="text-[11px] text-brand-gray">{t.admin.importWizard.noColumnsDetected}</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-brand-border bg-white">
      <table className="w-full text-[11px]">
        <thead className="border-b border-brand-border bg-brand-warm-white">
          <tr>
            {columns.map((c, i) => {
              const hi = highlights.get(i);
              return (
                <th key={i} className="p-2 text-left">
                  <div className="font-semibold text-brand-near-black">{c || t.admin.importWizard.columnPlaceholder(i + 1)}</div>
                  {hi && (
                    <div className="font-mono text-[9px] uppercase text-brand-orange">
                      → {TARGET_LABEL[hi as TargetField]}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-brand-border">
              {columns.map((_, ci) => (
                <td key={ci} className="p-2 text-brand-gray">
                  {r[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

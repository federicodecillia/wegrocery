"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { FieldHelp } from "@/components/ui/field-help";
import { CategorySelect } from "@/components/ui/category-select";
import {
  adminUpsertCatalogProduct,
  adminLoadFromCatalog,
  adminArchiveCatalogProduct
} from "@/lib/actions/admin";
import { formatEur, getProductEmoji, normalizeCategory } from "@/lib/utils";
import type { CatalogProductItem } from "@/lib/db/queries";
import { ImportListingWizard } from "./import-listing-wizard";
import { t } from "@/lib/i18n";

// Help copy shared by every product form (catalog + cycle edit). Centralising
// it keeps the wording consistent across the admin UI.
const HELP = {
  nome: t.admin.products.helpNome,
  varieta: t.admin.products.helpVarieta,
  formato: t.admin.products.helpFormato,
  prezzo: t.admin.products.helpPrezzo,
  prezzoKg: t.admin.products.helpPrezzoKg,
  categoria: t.admin.products.helpCategoria,
  icona: t.admin.products.helpIcona,
  note: t.admin.products.helpNote,
} as const;

// ── Catalog Product Form ──────────────────────────────────────────────────────

export function CatalogProductForm({
  supplierId,
  product,
  knownCategories = [],
  onClose,
}: {
  supplierId: string;
  product?: CatalogProductItem;
  /** Categories already present elsewhere in the catalog — surfaced in the dropdown. */
  knownCategories?: ReadonlyArray<string>;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [currentEmoji, setCurrentEmoji] = useState(
    product?.emoji ?? getProductEmoji(product?.name ?? ""),
  );
  // Admins who type the name first expect the icon to auto-suggest. We only
  // auto-update while the user has not explicitly picked an emoji yet.
  const [emojiTouched, setEmojiTouched] = useState(Boolean(product?.emoji));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ppkRaw = (fd.get("pricePerKg") as string | null)?.replace(",", ".").trim();
    const pricePerKg = ppkRaw ? parseFloat(ppkRaw) : null;
    const data = {
      catalogProductId: product?.catalogProductId,
      supplierId,
      name: fd.get("name") as string,
      variant: fd.get("variant") as string,
      format: fd.get("format") as string,
      // unit is no longer surfaced in the form — keep it intact on edits.
      unit: product?.unit ?? undefined,
      unitPrice: parseFloat((fd.get("unitPrice") as string).replace(",", ".")),
      pricePerKg: pricePerKg != null && !Number.isNaN(pricePerKg) ? pricePerKg : null,
      notes: fd.get("notes") as string,
      category: fd.get("category") as string,
      emoji: fd.get("emoji") as string,
    };

    startTransition(async () => {
      try {
        const result = await adminUpsertCatalogProduct(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(product ? t.admin.products.productUpdated : t.admin.products.productCreated);
        onClose();
      } catch {
        toast.error(t.admin.products.errorSaving);
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-teal/30";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-gray";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[14px] font-bold text-brand-near-black">
          {product ? t.admin.products.editProduct : t.admin.products.newProduct}
        </h4>
        <button type="button" onClick={onClose} className="text-[12px] text-brand-gray hover:text-brand-near-black">
          {t.admin.products.cancelEdit}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>
              {t.admin.products.nameLabel}<FieldHelp text={HELP.nome} />
            </label>
            <input
              name="name"
              required
              defaultValue={product?.name}
              placeholder={t.admin.products.namePlaceholder}
              className={inputCls}
              onChange={(e) => {
                if (!emojiTouched) setCurrentEmoji(getProductEmoji(e.target.value));
              }}
            />
          </div>
          <div className="w-[64px]">
            <label className={labelCls}>
              {t.admin.products.iconLabel}<FieldHelp text={HELP.icona} />
            </label>
            <EmojiPicker
              name="emoji"
              value={currentEmoji}
              onChange={(emoji) => {
                setCurrentEmoji(emoji);
                setEmojiTouched(true);
              }}
            />
          </div>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            {t.admin.products.variantLabel}<FieldHelp text={HELP.varieta} />
          </label>
          <input
            name="variant"
            defaultValue={product?.variant ?? ""}
            placeholder={t.admin.products.variantPlaceholder}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            {t.admin.products.formatLabel}<FieldHelp text={HELP.formato} />
          </label>
          <input
            name="format"
            placeholder={t.admin.products.formatPlaceholder}
            defaultValue={product?.format ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            {t.admin.products.priceLabel}<FieldHelp text={HELP.prezzo} />
          </label>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            required
            defaultValue={product?.unitPrice}
            placeholder={t.admin.products.pricePlaceholder}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            {t.admin.products.priceKgLabel} <span className="ml-1 text-brand-gray-light normal-case">{t.admin.products.priceKgOptional}</span>
            <FieldHelp text={HELP.prezzoKg} />
          </label>
          <input
            name="pricePerKg"
            type="number"
            step="0.01"
            defaultValue={product?.pricePerKg ?? ""}
            placeholder={t.admin.products.priceKgPlaceholder}
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            {t.admin.products.categoryFilter}<FieldHelp text={HELP.categoria} />
          </label>
          <CategorySelect
            name="category"
            value={product?.category ?? ""}
            extra={knownCategories}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            {t.admin.products.notesLabel}<FieldHelp text={HELP.note} />
          </label>
          <input
            name="notes"
            defaultValue={product?.notes ?? ""}
            placeholder={t.admin.products.notesCatalogPlaceholder}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-brand-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.products.savingProduct : product ? t.admin.common.saveChanges : t.admin.products.createProduct}
      </button>
    </form>
  );
}




// ── CSV Import/Export ────────────────────────────────────────────────────────

import {
  adminBuildProductTemplate,
  adminImportProductsCsv,
  adminImportProductsXlsx,
} from "@/lib/actions/admin-products";

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function CatalogCsvActions({ supplierId }: { supplierId: string }) {
  void supplierId; // wizard re-asks the supplier; this prop is kept for API parity
  const [isPending, startTransition] = useTransition();
  const [downloading, startDownload] = useTransition();
  const [wizardOpen, setWizardOpen] = useState(false);

  function downloadTemplate() {
    startDownload(async () => {
      const r = await adminBuildProductTemplate();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const blob = decodeBase64ToBlob(
        r.base64,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = r.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supplierId) {
      toast.error(t.admin.products.selectSupplierFirst);
      e.target.value = "";
      return;
    }

    const isXlsx = /\.xlsx$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result == null) {
        toast.error(t.admin.products.cannotReadFile);
        e.target.value = "";
        return;
      }
      startTransition(async () => {
        if (isXlsx) {
          const dataUrl = result as string;
          const idx = dataUrl.indexOf(",");
          const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
          const res = await adminImportProductsXlsx(supplierId, base64);
          if ("error" in res) {
            toast.error(res.error);
          } else {
            toast.success(t.admin.products.importedCount(res.count ?? 0));
          }
        } else {
          const text = result as string;
          const res = await adminImportProductsCsv(supplierId, text);
          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success(t.admin.products.importedCount(res.count ?? 0));
          }
        }
        e.target.value = "";
      });
    };
    if (isXlsx) reader.readAsDataURL(file);
    else reader.readAsText(file);
  }

  const btnBase =
    "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-bold shadow-sm transition disabled:opacity-60";
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={downloadTemplate}
        disabled={downloading}
        title={t.admin.products.templateTitle}
        className={`${btnBase} border-brand-border bg-white text-brand-teal hover:bg-brand-warm-white/50`}
      >
        {downloading ? t.admin.common.generating : t.admin.products.templateDownload}
      </button>
      <label
        title={t.admin.products.uploadFileTitle}
        className={`${btnBase} cursor-pointer border-brand-border bg-white text-brand-teal hover:bg-brand-warm-white/50 ${
          isPending || !supplierId ? "opacity-60" : ""
        }`}
      >
        {isPending ? t.admin.products.uploadLoading : t.admin.products.uploadFile}
        <input
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isPending || !supplierId}
        />
      </label>
      <button
        onClick={() => setWizardOpen(true)}
        title={t.admin.products.importGuidedTitle}
        className={`${btnBase} border-brand-orange/30 bg-brand-orange-light text-brand-orange hover:opacity-90`}
      >
        {t.admin.products.importGuided}
      </button>
      <ImportListingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        cycleId={null}
      />
    </div>
  );
}

// ── Load from catalog ─────────────────────────────────────────────────────────

export function CatalogLoadForm({
  cycleId,
  catalogProducts,
}: {
  cycleId: string;
  catalogProducts: CatalogProductItem[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleLoad() {
    if (selected.size === 0) return;
    startTransition(async () => {
      try {
        const result = await adminLoadFromCatalog(cycleId, Array.from(selected));
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(t.admin.products.loadedFromCatalog(result.count ?? 0));
        setSelected(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-brand-near-black">{t.admin.products.loadFromCatalogTitle}</p>
        <button
          onClick={() => setSelected(new Set(catalogProducts.map((p) => p.catalogProductId)))}
          className="text-[11px] font-semibold text-brand-teal"
        >
          {t.admin.products.selectAll}
        </button>
      </div>

      <div className="mb-3 max-h-60 overflow-y-auto rounded-lg border border-brand-border p-2">
        {catalogProducts.map((p) => (
          <label
            key={p.catalogProductId}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-brand-warm-white/50"
          >
            <input
              type="checkbox"
              checked={selected.has(p.catalogProductId)}
              onChange={() => toggle(p.catalogProductId)}
              className="rounded border-brand-border text-brand-teal focus:ring-brand-teal"
            />
            <div className="flex-1 text-[13px] text-brand-near-black">
              {p.name}
              {p.variant && <span className="ml-1 text-[12px] text-brand-gray">{p.variant}</span>}
              {p.format && (
                <span className="ml-1 font-mono text-[10px] text-brand-gray-light">({p.format})</span>
              )}
            </div>
            <div className="font-mono text-[12px] font-semibold text-brand-near-black">
              {formatEur(parseFloat(p.unitPrice))}
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleLoad}
        disabled={isPending || selected.size === 0}
        className="w-full rounded-xl bg-brand-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.products.loadingFromCatalog : t.admin.products.loadSelected(selected.size)}
      </button>
    </div>
  );
}

// ── Edit Cycle Product ────────────────────────────────────────────────────────

export function EditCycleProductForm({
  product,
  knownCategories = [],
  onClose,
}: {
  product: {
    productId: string;
    name: string;
    variant: string | null;
    format: string | null;
    unit: string | null;
    unitPrice: string;
    pricePerKg: string | null;
    notes: string | null;
    category: string | null;
  };
  knownCategories?: ReadonlyArray<string>;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ppkRaw = (fd.get("pricePerKg") as string | null)?.replace(",", ".").trim();
    const pricePerKg = ppkRaw ? parseFloat(ppkRaw) : null;
    const data = {
      name: fd.get("name") as string,
      variant: (fd.get("variant") as string) || undefined,
      format: (fd.get("format") as string) || undefined,
      // unit is no longer surfaced; keep whatever was already stored.
      unit: product.unit ?? undefined,
      unitPrice: parseFloat((fd.get("unitPrice") as string).replace(",", ".")),
      pricePerKg: pricePerKg != null && !Number.isNaN(pricePerKg) ? pricePerKg : null,
      notes: (fd.get("notes") as string) || undefined,
      category: (fd.get("category") as string) || undefined,
    };
    startTransition(async () => {
      try {
        const { adminUpdateCycleProduct } = await import("@/lib/actions/admin");
        const result = await adminUpdateCycleProduct(product.productId, data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(t.admin.products.productUpdated);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-teal/30";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-gray";

  return (
    <form onSubmit={handleSubmit} className="my-2 rounded-lg border border-brand-border bg-[#fdfdfd] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold text-brand-near-black">{t.admin.products.editCatalogProduct}</p>
        <button type="button" onClick={onClose} className="text-[11px] text-brand-gray">
          ✕ {t.admin.common.cancel}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            {t.admin.products.nameLabel}<FieldHelp text={HELP.nome} />
          </label>
          <input name="name" required defaultValue={product.name} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.variantLabel}<FieldHelp text={HELP.varieta} />
          </label>
          <input name="variant" defaultValue={product.variant ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.formatLabel}<FieldHelp text={HELP.formato} />
          </label>
          <input
            name="format"
            placeholder={t.admin.products.formatPlaceholder}
            defaultValue={product.format ?? ""}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.categoryFilter}<FieldHelp text={HELP.categoria} />
          </label>
          <CategorySelect
            name="category"
            value={product.category ?? ""}
            extra={knownCategories}
          />
        </div>
        <div className="col-span-1 sm:col-span-1">
          <label className={labelCls}>
            {t.admin.products.priceLabel}<FieldHelp text={HELP.prezzo} />
          </label>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            required
            defaultValue={product.unitPrice}
            className={inputCls}
          />
        </div>
        <div className="col-span-1 sm:col-span-1">
          <label className={labelCls}>
            {t.admin.products.priceKgLabel}<FieldHelp text={HELP.prezzoKg} />
          </label>
          <input
            name="pricePerKg"
            type="number"
            step="0.01"
            defaultValue={product.pricePerKg ?? ""}
            placeholder={t.admin.products.priceKgOptional}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            {t.admin.products.notesLabel}<FieldHelp text={HELP.note} />
          </label>
          <input name="notes" defaultValue={product.notes ?? ""} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-brand-teal py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.products.savingProduct : t.admin.common.saveChanges}
      </button>
    </form>
  );
}

// ── Product List Item ─────────────────────────────────────────────────────────

export function ProductListItem({
  product,
  index,
}: {
  product: {
    productId: string;
    name: string;
    variant: string | null;
    format: string | null;
    unit: string | null;
    unitPrice: string;
    pricePerKg: string | null;
    notes: string | null;
    category: string | null;
  };
  index: number;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <EditCycleProductForm product={product} onClose={() => setIsEditing(false)} />;
  }

  const emoji = product.name ? getProductEmoji(product.name) : "📦";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-warm-white/50 group">
      <span className="w-6 shrink-0 font-mono text-[11px] text-brand-gray-light">
        {index + 1}
      </span>
      <span className="shrink-0 text-[16px] leading-none">{emoji}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-brand-near-black">{product.name}</span>
        {product.variant && (
          <span className="ml-1.5 text-[12px] text-brand-gray">{product.variant}</span>
        )}
        {product.format && (
          <span className="ml-1.5 font-mono text-[10px] text-brand-gray-light">
            {product.format}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="shrink-0 text-right">
          <div className="font-mono text-[13px] font-bold text-brand-near-black">
            {formatEur(parseFloat(product.unitPrice))}
          </div>
          {product.pricePerKg && (
            <div className="font-mono text-[10px] text-brand-gray-light">
              ({formatEur(parseFloat(product.pricePerKg))}/kg)
            </div>
          )}
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-brand-teal shadow-sm ring-1 ring-inset ring-brand-teal/20 hover:bg-brand-teal hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          {t.admin.common.edit}
        </button>
      </div>
    </div>
  );
}

// ── Catalog Manager ───────────────────────────────────────────────────────────

export function CatalogManager({
  supplierId,
  supplierName,
  products,
}: {
  supplierId: string;
  supplierName: string;
  products: CatalogProductItem[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editingProduct = products.find((p) => p.catalogProductId === editingId);

  // Categories already used by this supplier — surfaced in the dropdown so
  // admins don't see only the generic defaults when they know what fits.
  const knownCategories = useMemo(() => {
    // Dedup case-insensitively, keeping the first-seen casing, so the
    // dropdown never offers "Verdura" and "verdura" side by side.
    const seen = new Map<string, string>();
    for (const p of products) {
      const label = p.category?.trim();
      if (!label) continue;
      const key = normalizeCategory(label);
      if (!seen.has(key)) seen.set(key, label);
    }
    return Array.from(seen.values());
  }, [products]);

  function handleArchive(id: string, active: boolean) {
    if (!window.confirm(active ? t.admin.products.reactivateConfirm : t.admin.products.archiveConfirm)) return;
    startTransition(async () => {
      const result = await adminArchiveCatalogProduct(id, active);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-border bg-[#fdfdfd] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-brand-near-black">{supplierName}</h3>
          <p className="text-[11px] text-brand-gray">{t.admin.products.catalogCount(products.length)}</p>
        </div>
        <div className="flex gap-2">
          <CatalogCsvActions supplierId={supplierId} />
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white transition-transform active:scale-95"
          >
            {t.admin.products.addProductButton}
          </button>
        </div>
      </div>

      {(showAdd || editingId) && (
        <CatalogProductForm
          supplierId={supplierId}
          product={editingProduct}
          knownCategories={knownCategories}
          onClose={() => {
            setShowAdd(false);
            setEditingId(null);
          }}
        />
      )}

      {products.length > 0 ? (
        <div className="divide-y divide-brand-border rounded-lg border border-brand-border bg-white overflow-hidden shadow-sm">
          {products.map((p) => (
            <div
              key={p.catalogProductId}
              className={`flex items-center gap-3 p-3 transition-colors hover:bg-brand-warm-white/30 ${
                !p.active ? "opacity-50 grayscale" : ""
              }`}
            >
              <span className="shrink-0 text-[18px]">{p.emoji || getProductEmoji(p.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-brand-near-black">{p.name}</span>
                  {!p.active && <span className="rounded bg-brand-gray-light px-1 py-0.5 text-[9px] font-bold uppercase text-brand-gray">{t.admin.products.archivedBadge}</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-brand-gray">
                  {p.variant && <span>{p.variant}</span>}
                  {p.format && <span className="font-mono text-[10px] text-brand-gray-light">({p.format})</span>}
                  {p.category && <span className="rounded-full bg-brand-teal-light px-2 text-brand-teal">{p.category}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-bold text-brand-near-black">
                  {formatEur(parseFloat(p.unitPrice))}
                </div>
                {p.pricePerKg && (
                  <div className="font-mono text-[10px] text-brand-gray-light">
                    ({formatEur(parseFloat(p.pricePerKg))}/kg)
                  </div>
                )}
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(p.catalogProductId)}
                    className="text-[10px] font-bold text-brand-teal hover:underline"
                  >
                    {t.admin.common.edit}
                  </button>
                  <button
                    onClick={() => handleArchive(p.catalogProductId, !p.active)}
                    className="text-[10px] font-bold text-brand-gray hover:text-brand-near-black hover:underline"
                  >
                    {p.active ? t.admin.common.archive : t.admin.common.restore}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-brand-border py-8 text-center text-[12px] text-brand-gray">
          {t.admin.products.noProductsForSupplier}
        </div>
      )}
    </div>
  );
}

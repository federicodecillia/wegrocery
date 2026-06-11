"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { FieldHelp } from "@/components/ui/field-help";
import { CategorySelect } from "@/components/ui/category-select";
import {
  adminArchiveSupplier,
  adminDeleteSupplier,
  adminUpsertSupplier,
  adminUpsertCatalogProduct,
  adminArchiveCatalogProduct,
  type UpsertSupplierInput,
  type UpsertCatalogProductInput,
} from "@/lib/actions/admin";
import type { CatalogProductItem } from "@/lib/db/queries";
import { formatEur } from "@/lib/utils";
import { t } from "@/lib/i18n";

const HELP_FIELDS = {
  nome: "Es: Mela rossa, Insalata, Pane integrale. È quello che vede il socio nel form ordine.",
  varieta: "Es: Bio, Stark, Granny Smith. Aggiungilo se ne esiste più di una variante.",
  formato: 'Cosa porti al socio per quel prezzo. Es: "Sacco 2kg", "Cestino", "Mazzo".',
  prezzo: "Quanto paga il socio per UN formato. Decimali con virgola o punto.",
  prezzoKg: "Opzionale: prezzo al chilo come riferimento. Comodo per prodotti a peso.",
  categoria: "Serve a raggruppare i prodotti nel form ordine. Scegli o aggiungi una nuova.",
  note: "Note libere, mostrate al socio.",
} as const;

type Supplier = {
  supplierId: string;
  name: string;
  macroCategory: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  cycleCount: number;
};

// ── Supplier Form ─────────────────────────────────────────────────────────────

export function FornitoriForm({
  supplier,
  onClose,
}: {
  supplier?: Supplier;
  onClose?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!supplier;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: UpsertSupplierInput = {
      supplierId: supplier?.supplierId,
      name: fd.get("name") as string,
      macroCategory: (fd.get("macroCategory") as string) || undefined,
      contactName: (fd.get("contactName") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      address: (fd.get("address") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
      active: true,
    };
    startTransition(async () => {
      try {
        await adminUpsertSupplier(data);
        toast.success(isEdit ? t.admin.suppliers.supplierUpdated : t.admin.suppliers.supplierAdded);
        onClose?.();
        if (!isEdit) (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-orange/30";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-gray";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-brand-border bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-brand-near-black">
          {isEdit ? t.admin.suppliers.editSupplier(supplier.name) : t.admin.suppliers.addSupplier}
        </p>
        {isEdit && onClose && (
          <button type="button" onClick={onClose} className="text-[11px] text-brand-gray">
            ✕ {t.admin.common.cancel}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>{t.admin.suppliers.nameLabel}</label>
            <input name="name" required defaultValue={supplier?.name} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t.admin.suppliers.categoryLabel}</label>
            <input
              name="macroCategory"
              placeholder={t.admin.suppliers.categoryPlaceholder}
              defaultValue={supplier?.macroCategory ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t.admin.suppliers.contactLabel}</label>
            <input
              name="contactName"
              defaultValue={supplier?.contactName ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t.admin.suppliers.phoneLabel}</label>
            <input
              name="phone"
              type="tel"
              defaultValue={supplier?.phone ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t.admin.suppliers.emailLabel}</label>
            <input
              name="email"
              type="email"
              defaultValue={supplier?.email ?? ""}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>{t.admin.suppliers.addressLabel}</label>
            <input
              name="address"
              defaultValue={supplier?.address ?? ""}
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>{t.admin.suppliers.notesLabel}</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={supplier?.notes ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-brand-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : isEdit ? t.admin.suppliers.submitEdit : t.admin.suppliers.submitAdd}
      </button>
    </form>
  );
}

// ── Catalog Product Form ──────────────────────────────────────────────────────

export function CatalogProductForm({
  supplierId,
  product,
  knownCategories = [],
  onClose,
}: {
  supplierId: string;
  product?: CatalogProductItem;
  knownCategories?: ReadonlyArray<string>;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ppkRaw = (fd.get("pricePerKg") as string | null)?.replace(",", ".").trim();
    const pricePerKg = ppkRaw ? parseFloat(ppkRaw) : null;
    const data: UpsertCatalogProductInput = {
      catalogProductId: product?.catalogProductId,
      supplierId,
      name: fd.get("name") as string,
      variant: (fd.get("variant") as string) || undefined,
      format: (fd.get("format") as string) || undefined,
      // unit no longer surfaced in UI — preserve existing value on edits.
      unit: product?.unit ?? undefined,
      unitPrice: parseFloat((fd.get("unitPrice") as string).replace(",", ".")),
      pricePerKg: pricePerKg != null && !Number.isNaN(pricePerKg) ? pricePerKg : null,
      notes: (fd.get("notes") as string) || undefined,
      category: (fd.get("category") as string) || undefined,
    };
    startTransition(async () => {
      try {
        const result = await adminUpsertCatalogProduct(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (result.archived) {
          toast.success(t.admin.products.priceUpdatedArchived);
        } else {
          toast.success(product ? t.admin.products.productUpdated : t.admin.products.productAddedToCatalog);
        }
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
    <form onSubmit={handleSubmit} className="mb-3 rounded-lg border border-brand-border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold text-brand-near-black">
          {product ? t.admin.products.editCatalogProduct : t.admin.products.newCatalogProduct}
        </p>
        <button type="button" onClick={onClose} className="text-[11px] text-brand-gray">
          ✕ {t.admin.common.cancel}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            {t.admin.products.nameLabel}<FieldHelp text={HELP_FIELDS.nome} />
          </label>
          <input name="name" required defaultValue={product?.name} placeholder={t.admin.products.namePlaceholder} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.variantLabel}<FieldHelp text={HELP_FIELDS.varieta} />
          </label>
          <input name="variant" defaultValue={product?.variant ?? ""} placeholder="es. Bio" className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.formatLabel}<FieldHelp text={HELP_FIELDS.formato} />
          </label>
          <input name="format" placeholder={t.admin.products.formatPlaceholder} defaultValue={product?.format ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            {t.admin.products.categoryFilter}<FieldHelp text={HELP_FIELDS.categoria} />
          </label>
          <CategorySelect
            name="category"
            value={product?.category ?? ""}
            extra={knownCategories}
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.priceLabel}<FieldHelp text={HELP_FIELDS.prezzo} />
          </label>
          <input name="unitPrice" type="number" step="0.01" required defaultValue={product?.unitPrice} placeholder={t.admin.products.pricePlaceholder} className={inputCls} />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className={labelCls}>
            {t.admin.products.priceKgLabel}<FieldHelp text={HELP_FIELDS.prezzoKg} />
          </label>
          <input
            name="pricePerKg"
            type="number"
            step="0.01"
            defaultValue={product?.pricePerKg ?? ""}
            placeholder={t.admin.products.priceKgOptional}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            {t.admin.products.notesLabel}<FieldHelp text={HELP_FIELDS.note} />
          </label>
          <input name="notes" defaultValue={product?.notes ?? ""} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-brand-teal py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.save}
      </button>
    </form>
  );
}

// ── Supplier List ─────────────────────────────────────────────────────────────

export function FornitoriList({
  suppliers,
  catalogBySupplier,
}: {
  suppliers: Supplier[];
  catalogBySupplier: Record<string, CatalogProductItem[]>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [addingCatalogFor, setAddingCatalogFor] = useState<string | null>(null);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Per-supplier list of categories already in use — passed to the dropdown
  // so admins see their own labels alongside the generic defaults.
  const knownCategoriesBySupplier = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    for (const [supplierId, list] of Object.entries(catalogBySupplier)) {
      result[supplierId] = Array.from(
        new Set(
          list
            .map((p) => p.category?.trim())
            .filter((c): c is string => Boolean(c)),
        ),
      );
    }
    return result;
  }, [catalogBySupplier]);

  function handleArchive(s: Supplier) {
    startTransition(async () => {
      try {
        await adminArchiveSupplier(s.supplierId, !s.active);
        toast.success(s.active ? t.admin.suppliers.supplierArchived : t.admin.suppliers.supplierReactivated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  function handleDelete(s: Supplier) {
    if (!window.confirm(t.admin.suppliers.deleteConfirm(s.name))) return;
    startTransition(async () => {
      const result = await adminDeleteSupplier(s.supplierId);
      if (result?.error) toast.error(result.error);
      else toast.success(t.admin.suppliers.supplierDeleted(s.name));
    });
  }

  const query = filter.toLowerCase().trim();
  const filtered = query
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.macroCategory?.toLowerCase().includes(query) ||
          s.email?.toLowerCase().includes(query),
      )
    : suppliers;

  const active = filtered.filter((s) => s.active);
  const archived = filtered.filter((s) => !s.active);

  function handleArchiveCatalogProduct(catalogProductId: string) {
    if (!window.confirm(t.admin.suppliers.archiveCatalogConfirm)) return;
    startTransition(async () => {
      const result = await adminArchiveCatalogProduct(catalogProductId, false);
      if (result.error) toast.error(result.error);
      else toast.success(t.admin.suppliers.productArchivedSuccess);
    });
  }

  function renderGroup(label: string, list: Supplier[]) {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-brand-gray-light">
          {label} ({list.length})
        </p>
        <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
          {list.map((s) => (
            <div key={s.supplierId} className="divide-y divide-brand-border">
              {editingId === s.supplierId ? (
                <div className="p-4">
                  <FornitoriForm supplier={s} onClose={() => setEditingId(null)} />
                </div>
              ) : (
                <>
                  {/* Supplier row — div+role rather than <button> so the
                      per-action buttons inside (Modifica/Archivia/✕) don't
                      end up as nested <button> descendants, which is invalid
                      HTML and trips a React hydration warning. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedId(expandedId === s.supplierId ? null : s.supplierId)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(expandedId === s.supplierId ? null : s.supplierId);
                      }
                    }}
                    aria-expanded={expandedId === s.supplierId}
                    className="flex w-full cursor-pointer items-center justify-between border-b border-brand-border px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-brand-near-black">{s.name}</span>
                        {!s.active && (
                          <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[9px] font-bold text-brand-gray">
                            {t.admin.suppliers.archivedBadge}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
                        {s.macroCategory && `${s.macroCategory} · `}
                        {s.contactName && `${s.contactName} · `}
                        {t.admin.suppliers.cyclesCount(s.cycleCount)}
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(s.supplierId); }}
                        className="rounded-full border border-brand-border px-2.5 py-1 text-[10px] font-semibold text-brand-gray"
                      >
                        {t.admin.common.edit}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(s); }}
                        className="rounded-full border border-brand-border px-2.5 py-1 text-[10px] font-semibold text-brand-gray"
                      >
                        {s.active ? t.admin.common.archive : t.admin.common.restore}
                      </button>
                      {s.cycleCount === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                          className="rounded-full border border-brand-red/30 px-2.5 py-1 text-[10px] font-semibold text-brand-red"
                        >
                          ✕
                        </button>
                      )}
                      <span className="text-[11px] text-brand-gray-light">
                        {expandedId === s.supplierId ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Contact details + products */}
                  {expandedId === s.supplierId && (
                    <div className="bg-black/[0.01] px-4 py-3">
                      {(s.phone || s.email || s.address) && (
                        <div className="mb-3 space-y-0.5 font-mono text-[11px] text-brand-gray">
                          {s.phone && <div>📞 {s.phone}</div>}
                          {s.email && <div>✉ {s.email}</div>}
                          {s.address && <div>📍 {s.address}</div>}
                          {s.notes && <div className="mt-1 italic text-brand-gray-light">{s.notes}</div>}
                        </div>
                      )}

                      {/* Catalog Section */}
                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-mono text-[9px] uppercase tracking-wider text-brand-gray-light">
                            {t.admin.suppliers.catalogLabel}
                          </p>
                          <button
                            onClick={() => {
                              setAddingCatalogFor(addingCatalogFor === s.supplierId ? null : s.supplierId);
                              setEditingCatalogId(null);
                            }}
                            className="text-[11px] font-semibold text-brand-teal"
                          >
                            {t.admin.suppliers.addCatalogProduct}
                          </button>
                        </div>
                        {addingCatalogFor === s.supplierId && (
                          <CatalogProductForm
                            supplierId={s.supplierId}
                            knownCategories={knownCategoriesBySupplier[s.supplierId] ?? []}
                            onClose={() => setAddingCatalogFor(null)}
                          />
                        )}
                        <div className="space-y-1">
                          {(catalogBySupplier[s.supplierId] ?? []).filter((p) => p.active).map((cp) => (
                            <div key={cp.catalogProductId} className="rounded border border-brand-border/50 bg-white px-3 py-2">
                              {editingCatalogId === cp.catalogProductId ? (
                                <CatalogProductForm
                                  supplierId={s.supplierId}
                                  product={cp}
                                  knownCategories={knownCategoriesBySupplier[s.supplierId] ?? []}
                                  onClose={() => setEditingCatalogId(null)}
                                />
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="text-[12px]">
                                    <span className="font-semibold text-brand-near-black">{cp.name}</span>
                                    {cp.variant && <span className="ml-1 text-brand-gray">· {cp.variant}</span>}
                                    {cp.format && <span className="ml-1 font-mono text-[10px] text-brand-gray-light">({cp.format})</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-[12px] font-semibold text-brand-near-black">
                                      {formatEur(parseFloat(cp.unitPrice))}
                                      {cp.pricePerKg && (
                                        <span className="ml-1 text-[10px] text-brand-gray-light">
                                          ({formatEur(parseFloat(cp.pricePerKg))}/kg)
                                        </span>
                                      )}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingCatalogId(cp.catalogProductId);
                                          setAddingCatalogFor(null);
                                        }}
                                        className="text-[10px] font-semibold text-brand-gray"
                                      >
                                        {t.admin.common.edit}
                                      </button>
                                      <button
                                        onClick={() => handleArchiveCatalogProduct(cp.catalogProductId)}
                                        className="text-[10px] font-semibold text-brand-gray"
                                      >
                                        {t.admin.common.archive}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {(catalogBySupplier[s.supplierId] ?? []).filter((p) => p.active).length === 0 && !addingCatalogFor && (
                            <p className="text-[12px] text-brand-gray">{t.admin.suppliers.noProductsInCatalog}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder={t.admin.suppliers.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-brand-border px-4 py-2.5 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
        />
      </div>
      {renderGroup(t.admin.suppliers.groupActive, active)}
      {renderGroup(t.admin.suppliers.groupArchived, archived)}
      {suppliers.length === 0 && (
        <div className="rounded-xl border border-dashed border-brand-border p-6 text-center text-[13px] text-brand-gray">
          {t.admin.suppliers.noSuppliers}
        </div>
      )}
    </div>
  );
}

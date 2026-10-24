"use client";

import { confirm } from "@/components/ui/confirm-dialog";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { adminArchiveCatalogProduct } from "@/lib/actions/admin";
import type { CatalogProductItem } from "@/lib/db/queries";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { CatalogCsvActions, CatalogProductForm, GuidedImportButton } from "./prodotti-forms";
import { t } from "@/lib/i18n";
import { NativeSelect } from "@/components/ui/native-select";
import { labelClass } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { filterCatalogProducts } from "@/lib/catalog-filter";

type SupplierWithCatalog = {
  supplier: {
    supplierId: string;
    name: string;
  };
  products: CatalogProductItem[];
};

type ProductWithSupplier = CatalogProductItem & {
  supplierName: string;
};

type GroupBy = "category" | "supplier";

const ALL = "__all__";

function groupProducts(products: ProductWithSupplier[], groupBy: GroupBy) {
  const groups = new Map<string, ProductWithSupplier[]>();
  for (const product of products) {
    const key =
      groupBy === "category"
        ? product.category?.trim() || t.common.noCategory
        : product.supplierName;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "it"));
}

export function SupplierCatalogList({
  initialData,
  initialSupplierId,
}: {
  initialData: SupplierWithCatalog[];
  /** From Fornitori's "N prodotti nel catalogo →" (?supplier=). */
  initialSupplierId?: string;
}) {
  const suppliers = initialData.map((item) => item.supplier);
  const allProducts = useMemo(
    () =>
      initialData.flatMap(({ supplier, products }) =>
        products.map((product) => ({ ...product, supplierName: supplier.name })),
      ),
    [initialData],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(allProducts.map((p) => p.category?.trim()).filter((v): v is string => Boolean(v))),
      ).sort((a, b) => a.localeCompare(b, "it")),
    [allProducts],
  );

  const [supplierFilter, setSupplierFilter] = useState(
    initialSupplierId && suppliers.some((s) => s.supplierId === initialSupplierId) ? initialSupplierId : ALL,
  );
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [uploadSupplierId, setUploadSupplierId] = useState(suppliers[0]?.supplierId ?? "");
  const [addingSupplierId, setAddingSupplierId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = filterCatalogProducts(
    allProducts.filter((product) => {
      const supplierMatch = supplierFilter === ALL || product.supplierId === supplierFilter;
      const categoryMatch = categoryFilter === ALL || product.category === categoryFilter;
      return supplierMatch && categoryMatch;
    }),
    query,
  );

  const grouped = groupProducts(filtered, groupBy);

  async function handleArchive(id: string, active: boolean) {
    if (!(await confirm({ title: active ? t.admin.products.reactivateConfirm : t.admin.products.archiveConfirm, danger: !active }))) return;
    startTransition(async () => {
      const result = await adminArchiveCatalogProduct(id, active);
      if (result.error) toast.error(result.error);
      else toast.success(active ? t.admin.products.productUpdated : t.admin.suppliers.productArchivedSuccess);
    });
  }

  const defaultAddSupplierId = supplierFilter !== ALL ? supplierFilter : uploadSupplierId;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[14px] font-bold text-foreground">{t.admin.products.uploadTitle}</h3>
        <p className="mb-3 text-label text-secondary-foreground">{t.admin.products.uploadSubtitle}</p>
        <GuidedImportButton />
        <details className="group mt-3">
          <summary className="flex min-h-(--control-h) cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-secondary-foreground">
            <span aria-hidden className="text-label transition-transform group-open:rotate-90">▶</span>
            {t.admin.products.otherFormats}
          </summary>
          <div className="mt-2 space-y-3">
            <p className="text-label text-secondary-foreground">{t.admin.products.otherFormatsHint}</p>
            <label className="block">
              <span className={labelClass}>
                {t.admin.products.uploadSupplierLabel}
              </span>
              <NativeSelect
                value={uploadSupplierId}
                onChange={(e) => setUploadSupplierId(e.target.value)}
              >
                {suppliers.length === 0 ? (
                  <option value="">{t.admin.products.noSupplierAvailable}</option>
                ) : (
                  suppliers.map((supplier) => (
                    <option key={supplier.supplierId} value={supplier.supplierId}>
                      {supplier.name}
                    </option>
                  ))
                )}
              </NativeSelect>
            </label>
            <CatalogCsvActions supplierId={uploadSupplierId} />
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-foreground">{t.admin.products.catalogSectionTitle}</h3>
            <p className="text-label text-secondary-foreground">
              {t.admin.products.filteredCount(filtered.length, allProducts.length)}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setAddingSupplierId(defaultAddSupplierId || suppliers[0]?.supplierId || null);
            }}
            disabled={suppliers.length === 0}
            className="rounded-lg bg-accent px-3 py-1.5 text-label font-bold text-accent-foreground disabled:opacity-50"
          >
            {t.admin.products.addButton}
          </button>
        </div>

        <div className="grid gap-3">
          <Input
            type="search"
            aria-label={t.admin.products.searchPlaceholder}
            placeholder={t.admin.products.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-xl px-4 py-2.5"
          />
          <label className="block">
            <span className={labelClass}>
              {t.admin.products.supplierFilter}
            </span>
            <NativeSelect
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value={ALL}>{t.admin.products.allSuppliers}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplierId} value={supplier.supplierId}>
                  {supplier.name}
                </option>
              ))}
            </NativeSelect>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>
                {t.admin.products.categoryFilter}
              </span>
              <NativeSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value={ALL}>{t.admin.products.allCategories}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="block">
              <span className={labelClass}>
                {t.admin.products.groupBy}
              </span>
              <NativeSelect
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              >
                <option value="category">{t.admin.products.groupByCategory}</option>
                <option value="supplier">{t.admin.products.groupBySupplier}</option>
              </NativeSelect>
            </label>
          </div>
        </div>
      </section>

      {/* A new product opens here; an edit opens under its own row. */}
      {addingSupplierId && (
        <CatalogProductForm
          supplierId={addingSupplierId}
          knownCategories={categories}
          onClose={() => setAddingSupplierId(null)}
        />
      )}

      {grouped.length > 0 ? (
        <div className="space-y-5">
          {grouped.map(([groupName, products]) => (
            <section key={groupName} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
                <h3 className="text-[13px] font-bold text-foreground">{groupName}</h3>
                <span className="tabular-nums text-label text-secondary-foreground">{products.length}</span>
              </div>
              <div className="divide-y divide-border">
                {products.map((product) => (
                  <div key={product.catalogProductId}>
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-background/40 ${
                      !product.active ? "opacity-50 grayscale" : ""
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-[22px] leading-none">
                      {product.emoji || getProductEmoji(product.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-foreground">{product.name}</span>
                        {!product.active && (
                          <span className="rounded bg-neutral px-1 py-0.5 text-label font-bold uppercase text-secondary-foreground">
                            {t.admin.products.archivedBadge}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-label text-secondary-foreground">
                        <span>{product.supplierName}</span>
                        {product.category && <span>{product.category}</span>}
                        {product.variant && <span>{product.variant}</span>}
                        {product.format && <span>{product.format}</span>}
                      </div>
                      {product.notes && (
                        <div className="mt-1 text-label text-muted-foreground">{product.notes}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tabular-nums text-[13px] font-bold text-foreground">
                        {formatEur(parseFloat(product.unitPrice))}
                      </div>
                      {product.pricePerKg && (
                        <div className="tabular-nums text-label text-muted-foreground">
                          ({formatEur(parseFloat(product.pricePerKg))}/kg)
                        </div>
                      )}
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setAddingSupplierId(null);
                            setEditingId(product.catalogProductId);
                          }}
                          aria-expanded={editingId === product.catalogProductId}
                          className="text-label font-bold text-accent-text hover:underline"
                        >
                          {t.admin.common.edit}
                        </button>
                        <button
                          onClick={() => handleArchive(product.catalogProductId, !product.active)}
                          className="text-label font-bold text-secondary-foreground hover:text-foreground hover:underline"
                        >
                          {product.active ? t.admin.common.archive : t.admin.common.restore}
                        </button>
                      </div>
                    </div>
                  </div>
                  {editingId === product.catalogProductId && (
                    <InlineEditor>
                      <CatalogProductForm
                        supplierId={product.supplierId}
                        product={product}
                        knownCategories={categories}
                        onClose={() => setEditingId(null)}
                      />
                    </InlineEditor>
                  )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-secondary-foreground">
          {t.admin.products.noProductsFiltered}
        </div>
      )}
    </div>
  );
}

// Holds the edit form under the product's row and brings it into view, so a
// product far down the list is edited where it is.
function InlineEditor({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} className="scroll-mb-24 border-t border-border bg-background p-3 [&>form]:mb-0">
      {children}
    </div>
  );
}

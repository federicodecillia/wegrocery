"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { 
  adminUpsertCatalogProduct, 
  adminLoadFromCatalog,
  adminArchiveCatalogProduct
} from "@/lib/actions/admin";
import { formatEur, getProductEmoji } from "@/lib/utils";
import type { CatalogProductItem } from "@/lib/db/queries";

// ── Catalog Product Form ──────────────────────────────────────────────────────

export function CatalogProductForm({
  supplierId,
  product,
  onClose,
}: {
  supplierId: string;
  product?: CatalogProductItem;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [tempEmoji, setTempEmoji] = useState(product?.emoji ?? getProductEmoji(product?.name ?? ""));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      catalogProductId: product?.catalogProductId,
      supplierId,
      name: fd.get("name") as string,
      variant: fd.get("variant") as string,
      format: fd.get("format") as string,
      unit: fd.get("unit") as string,
      unitPrice: parseFloat((fd.get("unitPrice") as string).replace(",", ".")),
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
        toast.success(product ? "Prodotto aggiornato" : "Prodotto creato");
        onClose();
      } catch {
        toast.error("Errore nel salvataggio");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray";

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[14px] font-bold text-pm-near-black">
          {product ? "Modifica Prodotto" : "Nuovo Prodotto"}
        </h4>
        <button type="button" onClick={onClose} className="text-[12px] text-pm-gray hover:text-pm-near-black">
          Annulla
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Nome *</label>
            <input 
              name="name" 
              required 
              defaultValue={product?.name} 
              className={inputCls} 
              onChange={(e) => setTempEmoji(getProductEmoji(e.target.value))}
            />
          </div>
          <div className="w-16">
            <label className={labelCls}>Icona</label>
            <input 
              name="emoji" 
              defaultValue={product?.emoji ?? tempEmoji} 
              className={`${inputCls} text-center text-lg`} 
              maxLength={2}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Varietà</label>
          <input name="variant" defaultValue={product?.variant ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Formato</label>
          <input name="format" placeholder="es. 1 kg" defaultValue={product?.format ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Unità</label>
          <input name="unit" placeholder="es. kg" defaultValue={product?.unit ?? ""} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Prezzo *</label>
          <input name="unitPrice" type="number" step="0.01" required defaultValue={product?.unitPrice} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Categoria</label>
          <input name="category" defaultValue={product?.category ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Note</label>
          <input name="notes" defaultValue={product?.notes ?? ""} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-pm-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Salvataggio…" : product ? "Salva Modifiche" : "Crea Prodotto"}
      </button>
    </form>
  );
}




// ── CSV Import/Export ────────────────────────────────────────────────────────

import { adminImportProductsCsv } from "@/lib/actions/admin-products";

export function CatalogCsvActions({ supplierId }: { supplierId: string }) {
  const [isPending, startTransition] = useTransition();

  function downloadTemplate() {
    const headers = "Nome;Varietà;Formato;Unità;Prezzo;Categoria;Icona;Note";
    const example = "Mela Rossa;Bio;Sacco 2kg;kg;2,50;Frutta;🍎;Dolce e croccante";
    const csvContent = headers + "\n" + example;
    
    // Create a blob with UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `template_prodotti.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supplierId) {
      toast.error("Seleziona prima un fornitore");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      startTransition(async () => {
        const result = await adminImportProductsCsv(supplierId, text);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Importati ${result.count} prodotti ✓`);
        }
        e.target.value = "";
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={downloadTemplate}
        className="rounded-lg border border-pm-border bg-white px-3 py-1.5 text-[11px] font-bold text-pm-teal shadow-sm hover:bg-pm-warm-white/50"
      >
        📥 Scarica Template
      </button>
      <label className="cursor-pointer rounded-lg border border-pm-border bg-white px-3 py-1.5 text-[11px] font-bold text-pm-teal shadow-sm hover:bg-pm-warm-white/50">
        {isPending ? "Caricamento..." : "📤 Carica CSV/Excel"}
        <input
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isPending || !supplierId}
        />
      </label>
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
        toast.success(`${result.count} prodotti caricati dal catalogo`);
        setSelected(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  return (
    <div className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-pm-near-black">Carica da catalogo fornitore</p>
        <button
          onClick={() => setSelected(new Set(catalogProducts.map((p) => p.catalogProductId)))}
          className="text-[11px] font-semibold text-pm-teal"
        >
          Seleziona tutti
        </button>
      </div>

      <div className="mb-3 max-h-60 overflow-y-auto rounded-lg border border-pm-border p-2">
        {catalogProducts.map((p) => (
          <label
            key={p.catalogProductId}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-pm-warm-white/50"
          >
            <input
              type="checkbox"
              checked={selected.has(p.catalogProductId)}
              onChange={() => toggle(p.catalogProductId)}
              className="rounded border-pm-border text-pm-teal focus:ring-pm-teal"
            />
            <div className="flex-1 text-[13px] text-pm-near-black">
              {p.name}
              {p.variant && <span className="ml-1 text-[12px] text-pm-gray">{p.variant}</span>}
              {p.format && (
                <span className="ml-1 font-mono text-[10px] text-pm-gray-light">({p.format})</span>
              )}
            </div>
            <div className="font-mono text-[12px] font-semibold text-pm-near-black">
              {formatEur(parseFloat(p.unitPrice))}
              {p.unit ? `/${p.unit}` : ""}
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleLoad}
        disabled={isPending || selected.size === 0}
        className="w-full rounded-xl bg-pm-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Caricamento…" : `Carica ${selected.size} prodotti`}
      </button>
    </div>
  );
}

// ── Edit Cycle Product ────────────────────────────────────────────────────────

export function EditCycleProductForm({
  product,
  onClose,
}: {
  product: {
    productId: string;
    name: string;
    variant: string | null;
    format: string | null;
    unit: string | null;
    unitPrice: string;
    notes: string | null;
    category: string | null;
  };
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      variant: (fd.get("variant") as string) || undefined,
      format: (fd.get("format") as string) || undefined,
      unit: (fd.get("unit") as string) || undefined,
      unitPrice: parseFloat((fd.get("unitPrice") as string).replace(",", ".")),
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
        toast.success("Prodotto aggiornato");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray";

  return (
    <form onSubmit={handleSubmit} className="my-2 rounded-lg border border-pm-border bg-[#fdfdfd] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold text-pm-near-black">Modifica prodotto</p>
        <button type="button" onClick={onClose} className="text-[11px] text-pm-gray">
          ✕ Annulla
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>Nome *</label>
          <input name="name" required defaultValue={product.name} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>Varietà</label>
          <input name="variant" defaultValue={product.variant ?? ""} className={inputCls} />
        </div>
        <div className="col-span-1">
          <label className={labelCls}>Formato</label>
          <input name="format" placeholder="es. 1 kg" defaultValue={product.format ?? ""} className={inputCls} />
        </div>
        <div className="col-span-1">
          <label className={labelCls}>Unità</label>
          <input name="unit" placeholder="es. kg" defaultValue={product.unit ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Categoria</label>
          <input name="category" placeholder="es. Frutta" defaultValue={product.category ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Prezzo *</label>
          <input name="unitPrice" type="number" step="0.01" required defaultValue={product.unitPrice} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>Note</label>
          <input name="notes" defaultValue={product.notes ?? ""} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-pm-teal py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Salvataggio…" : "Salva modifiche"}
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
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-pm-warm-white/50 group">
      <span className="w-6 shrink-0 font-mono text-[11px] text-pm-gray-light">
        {index + 1}
      </span>
      <span className="shrink-0 text-[16px] leading-none">{emoji}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-pm-near-black">{product.name}</span>
        {product.variant && (
          <span className="ml-1.5 text-[12px] text-pm-gray">{product.variant}</span>
        )}
        {product.format && (
          <span className="ml-1.5 font-mono text-[10px] text-pm-gray-light">
            {product.format}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[13px] font-bold text-pm-near-black">
          {formatEur(parseFloat(product.unitPrice))}{product.unit ? `/${product.unit}` : ""}
        </span>
        <button
          onClick={() => setIsEditing(true)}
          className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-pm-teal shadow-sm ring-1 ring-inset ring-pm-teal/20 hover:bg-pm-teal hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          Modifica
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

  function handleArchive(id: string, active: boolean) {
    if (!window.confirm(active ? "Riattivare il prodotto?" : "Archiviare il prodotto?")) return;
    startTransition(async () => {
      const result = await adminArchiveCatalogProduct(id, active);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-pm-border bg-[#fdfdfd] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-pm-near-black">{supplierName}</h3>
          <p className="text-[11px] text-pm-gray">{products.length} prodotti a catalogo</p>
        </div>
        <div className="flex gap-2">
          <CatalogCsvActions supplierId={supplierId} />
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-pm-teal px-3 py-1.5 text-[11px] font-bold text-white transition-transform active:scale-95"
          >
            + Aggiungi Prodotto
          </button>
        </div>
      </div>

      {(showAdd || editingId) && (
        <CatalogProductForm
          supplierId={supplierId}
          product={editingProduct}
          onClose={() => {
            setShowAdd(false);
            setEditingId(null);
          }}
        />
      )}

      {products.length > 0 ? (
        <div className="divide-y divide-pm-border rounded-lg border border-pm-border bg-white overflow-hidden shadow-sm">
          {products.map((p) => (
            <div
              key={p.catalogProductId}
              className={`flex items-center gap-3 p-3 transition-colors hover:bg-pm-warm-white/30 ${
                !p.active ? "opacity-50 grayscale" : ""
              }`}
            >
              <span className="shrink-0 text-[18px]">{p.emoji || getProductEmoji(p.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-pm-near-black">{p.name}</span>
                  {!p.active && <span className="rounded bg-pm-gray-light px-1 py-0.5 text-[9px] font-bold uppercase text-pm-gray">Archiviato</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-pm-gray">
                  {p.variant && <span>{p.variant}</span>}
                  {p.format && <span className="font-mono text-[10px] text-pm-gray-light">({p.format})</span>}
                  {p.category && <span className="rounded-full bg-pm-teal-light px-2 text-pm-teal">{p.category}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] font-bold text-pm-near-black">
                  {formatEur(parseFloat(p.unitPrice))}
                  {p.unit ? `/${p.unit}` : ""}
                </div>
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(p.catalogProductId)}
                    className="text-[10px] font-bold text-pm-teal hover:underline"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleArchive(p.catalogProductId, !p.active)}
                    className="text-[10px] font-bold text-pm-gray hover:text-pm-near-black hover:underline"
                  >
                    {p.active ? "Archivia" : "Ripristina"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-pm-border py-8 text-center text-[12px] text-pm-gray">
          Nessun prodotto per questo fornitore.
        </div>
      )}
    </div>
  );
}

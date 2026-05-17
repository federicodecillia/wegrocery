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
import { formatEur, getProductEmoji } from "@/lib/utils";
import type { CatalogProductItem } from "@/lib/db/queries";

// Help copy shared by every product form (catalog + cycle edit). Centralising
// it keeps the wording consistent across the admin UI.
const HELP = {
  nome: "Es: Mela rossa, Insalata, Pane integrale. È quello che vede il socio nel form ordine.",
  varieta: "Es: Bio, Stark, Granny Smith. Aggiungilo se ne esiste più di una variante.",
  formato: 'Cosa porti al socio per quel prezzo. Es: "Sacco 2kg", "Cestino", "Mazzo", "Cassetta".',
  prezzo: "Quanto paga il socio per UN formato (es. €5 per il sacco da 2kg). Decimali con virgola o punto.",
  prezzoKg:
    "Opzionale: prezzo al chilo come riferimento (es. €2,50/kg). Comodo per prodotti a peso così i soci confrontano.",
  categoria:
    "Serve a raggruppare i prodotti nel form ordine. Scegli dall'elenco o aggiungine una nuova.",
  icona: "Emoji mostrata accanto al prodotto. Clicca per scegliere o cercare.",
  note: 'Note libere, mostrate al socio. Es: "Coltivata in serra", "Da consumare entro 3 giorni".',
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
        <div className="col-span-2 flex items-end gap-3">
          <div className="flex-1">
            <label className={labelCls}>
              Nome *<FieldHelp text={HELP.nome} />
            </label>
            <input
              name="name"
              required
              defaultValue={product?.name}
              placeholder="es. Mela rossa"
              className={inputCls}
              onChange={(e) => {
                if (!emojiTouched) setCurrentEmoji(getProductEmoji(e.target.value));
              }}
            />
          </div>
          <div className="w-[64px]">
            <label className={labelCls}>
              Icona<FieldHelp text={HELP.icona} />
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
            Varietà<FieldHelp text={HELP.varieta} />
          </label>
          <input
            name="variant"
            defaultValue={product?.variant ?? ""}
            placeholder="es. Bio, Stark"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Formato<FieldHelp text={HELP.formato} />
          </label>
          <input
            name="format"
            placeholder="es. Sacco 2kg"
            defaultValue={product?.format ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Prezzo *<FieldHelp text={HELP.prezzo} />
          </label>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            required
            defaultValue={product?.unitPrice}
            placeholder="es. 5,00"
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            Prezzo / kg <span className="ml-1 text-pm-gray-light normal-case">(opzionale)</span>
            <FieldHelp text={HELP.prezzoKg} />
          </label>
          <input
            name="pricePerKg"
            type="number"
            step="0.01"
            defaultValue={product?.pricePerKg ?? ""}
            placeholder="es. 2,50"
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            Categoria<FieldHelp text={HELP.categoria} />
          </label>
          <CategorySelect
            name="category"
            value={product?.category ?? ""}
            extra={knownCategories}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>
            Note<FieldHelp text={HELP.note} />
          </label>
          <input
            name="notes"
            defaultValue={product?.notes ?? ""}
            placeholder="es. coltivata in serra"
            className={inputCls}
          />
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
    // Column order matches `adminImportProductsCsv`. Prezzo/kg is optional —
    // leave the cell empty for items that are not weight-priced.
    const headers = "Nome;Varietà;Formato;Prezzo;Prezzo/kg;Categoria;Icona;Note";
    const example1 = "Insalata mista;Bio;Cestino 200g;3,00;15,00;Verdura;🥬;Raccolta del mattino";
    const example2 = "Pasta integrale;;Pacco 500g;1,80;;Pasta e riso;🍝;";
    const csvContent = headers + "\n" + example1 + "\n" + example2;
    
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
          <label className={labelCls}>
            Nome *<FieldHelp text={HELP.nome} />
          </label>
          <input name="name" required defaultValue={product.name} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            Varietà<FieldHelp text={HELP.varieta} />
          </label>
          <input name="variant" defaultValue={product.variant ?? ""} className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            Formato<FieldHelp text={HELP.formato} />
          </label>
          <input
            name="format"
            placeholder="es. Sacco 2kg"
            defaultValue={product.format ?? ""}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={labelCls}>
            Categoria<FieldHelp text={HELP.categoria} />
          </label>
          <CategorySelect
            name="category"
            value={product.category ?? ""}
            extra={knownCategories}
          />
        </div>
        <div className="col-span-1 sm:col-span-1">
          <label className={labelCls}>
            Prezzo *<FieldHelp text={HELP.prezzo} />
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
            Prezzo / kg<FieldHelp text={HELP.prezzoKg} />
          </label>
          <input
            name="pricePerKg"
            type="number"
            step="0.01"
            defaultValue={product.pricePerKg ?? ""}
            placeholder="opzionale"
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={labelCls}>
            Note<FieldHelp text={HELP.note} />
          </label>
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
        <div className="shrink-0 text-right">
          <div className="font-mono text-[13px] font-bold text-pm-near-black">
            {formatEur(parseFloat(product.unitPrice))}
            {product.unit ? `/${product.unit}` : ""}
          </div>
          {product.pricePerKg && (
            <div className="font-mono text-[10px] text-pm-gray-light">
              ({formatEur(parseFloat(product.pricePerKg))}/kg)
            </div>
          )}
        </div>
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

  // Categories already used by this supplier — surfaced in the dropdown so
  // admins don't see only the generic defaults when they know what fits.
  const knownCategories = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((p) => p.category?.trim())
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [products],
  );

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
          knownCategories={knownCategories}
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
                {p.pricePerKg && (
                  <div className="font-mono text-[10px] text-pm-gray-light">
                    ({formatEur(parseFloat(p.pricePerKg))}/kg)
                  </div>
                )}
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

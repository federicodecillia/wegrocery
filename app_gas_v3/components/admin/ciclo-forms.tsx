"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import {
  adminCloseCycle,
  adminCreateCycle,
  adminUpdateCycle,
  type CreateCycleInput,
} from "@/lib/actions/admin";
import { formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CatalogProductItem } from "@/lib/db/queries";
import { ClosedCycleDetails } from "./closed-cycle-details";

type Supplier = { supplierId: string; name: string };

type SerializedCycle = {
  cycleId: string;
  title: string;
  orderCloseAt: string | null;
  pickupDate: string | null;
  pickupEndTime: string | null;
  notes: string | null;
  supplierId: string | null;
  accessLevel: string;
  isOverdue: boolean;
};

// ── Open Cycle Card ───────────────────────────────────────────────────────────

export function OpenCycleCard({
  cycle,
  stats,
  suppliers,
}: {
  cycle: SerializedCycle;
  stats: { orderCount: number; grandTotal: number };
  suppliers: Supplier[];
}) {
  const [editing, setEditing] = useState(false);
  const [managingProducts, setManagingProducts] = useState(false);

  return (
    <Card className="mb-4 border-l-4 border-l-pm-teal">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-pm-teal-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pm-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-pm-teal" />
            Aperto
          </span>
          <h3 className="mt-1 text-[15px] font-bold text-pm-near-black">{cycle.title}</h3>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setManagingProducts((v) => !v)}
            className="rounded-xl border border-pm-teal/30 bg-pm-teal-light px-3 py-1.5 text-[11px] font-bold text-pm-teal"
          >
            {managingProducts ? "Chiudi Prodotti" : "Gestisci Prodotti"}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-xl border border-pm-border px-3 py-1.5 text-[11px] font-semibold text-pm-gray"
          >
            {editing ? "Annulla" : "Modifica"}
          </button>
          <CloseCycleButton cycleId={cycle.cycleId} cycleTitle={cycle.title} />
        </div>
      </CardHeader>
      {editing ? (
        <CardBody>
          <EditCycleForm cycle={cycle} suppliers={suppliers} onClose={() => setEditing(false)} />
        </CardBody>
      ) : (
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-pm-orange-light px-3 py-2">
              <div className="font-mono text-[11px] text-pm-gray">Ordini</div>
              <div className="text-[20px] font-bold text-pm-near-black">{stats.orderCount}</div>
            </div>
            <div className="rounded-lg bg-pm-teal-light px-3 py-2">
              <div className="font-mono text-[11px] text-pm-gray">Totale</div>
              <div className="text-[20px] font-bold text-pm-near-black">
                {formatEur(stats.grandTotal)}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-[12px] text-pm-gray">
            {cycle.isOverdue && (
              <div className="rounded-lg border border-pm-red/30 bg-pm-red-light p-3 text-pm-red">
                Notifica admin: la data di chiusura e&apos; passata. Controlla il recap e chiudi il ciclo.
              </div>
            )}
            {cycle.orderCloseAt && (
              <div>
                Chiusura ordini:{" "}
                <span className="font-semibold text-pm-near-black">
                  {new Date(cycle.orderCloseAt).toLocaleString("it-IT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {cycle.pickupDate && (
              <div>
                Ritiro:{" "}
                <span className="font-semibold text-pm-near-black">
                  {new Date(cycle.pickupDate).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {/* show time if set */}
                  {cycle.pickupDate.includes("T") && !cycle.pickupDate.endsWith("T00:00:00.000Z") &&
                    ` dalle ${new Date(cycle.pickupDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}
                  {cycle.pickupEndTime && ` alle ${cycle.pickupEndTime}`}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3">
            <ClosedCycleDetails
              cycleId={cycle.cycleId}
              cycleTitle={cycle.title}
              buttonLabel="Recap ordini"
            />
          </div>
          {managingProducts && (
            <div className="mt-6 border-t border-pm-border pt-4">
              <CycleProductPicker cycleId={cycle.cycleId} suppliers={suppliers} />
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}

// ── Edit Cycle Form ───────────────────────────────────────────────────────────

function EditCycleForm({ cycle, suppliers, onClose }: { cycle: SerializedCycle; suppliers: Supplier[]; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await adminUpdateCycle(cycle.cycleId, {
        title: fd.get("title") as string,
        pickupDate: fd.get("pickupDate") as string,
        pickupEndTime: fd.get("pickupEndTime") as string,
        orderCloseAt: fd.get("orderCloseAt") as string,
        notes: fd.get("notes") as string,
        supplierId: fd.get("supplierId") as string,
        accessLevel: fd.get("accessLevel") as string,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Ciclo aggiornato");
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
          Titolo *
        </label>
        <input
          name="title"
          required
          defaultValue={cycle.title}
          className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Chiusura ordini *
          </label>
          <input
            name="orderCloseAt"
            type="datetime-local"
            required
            defaultValue={cycle.orderCloseAt?.slice(0, 16) ?? ""}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Data ritiro
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              name="pickupDate"
              type="datetime-local"
              defaultValue={cycle.pickupDate?.slice(0, 16) ?? ""}
              className="flex-1 min-w-[150px] rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            />
            <input
              name="pickupEndTime"
              type="time"
              defaultValue={cycle.pickupEndTime ?? ""}
              className="w-24 shrink-0 rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Fornitore Principale
          </label>
          <select
            name="supplierId"
            defaultValue={cycle.supplierId ?? ""}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          >
            <option value="">— nessuno —</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Accesso
          </label>
          <select
            name="accessLevel"
            defaultValue={cycle.accessLevel}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          >
            <option value="admin">Solo Admin</option>
            <option value="soci">Soci Attivi</option>
            <option value="utenti">Tutti gli utenti</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
          Note
        </label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={cycle.notes ?? ""}
          className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-pm-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Salvataggio…" : "Salva modifiche"}
      </button>
    </form>
  );
}

// ── Create Cycle Form ─────────────────────────────────────────────────────────

export function CreateCycleForm({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: CreateCycleInput = {
      title: fd.get("title") as string,
      pickupDate: fd.get("pickupDate") as string,
      pickupEndTime: fd.get("pickupEndTime") as string,
      orderCloseAt: fd.get("orderCloseAt") as string,
      supplierId: fd.get("supplierId") as string,
      accessLevel: fd.get("accessLevel") as string,
      notes: fd.get("notes") as string,
    };
    startTransition(async () => {
      const result = await adminCreateCycle(data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Ciclo creato");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-pm-orange/40 py-3 text-[13px] font-semibold text-pm-orange"
      >
        + Crea nuovo ciclo
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <p className="mb-3 text-[13px] font-bold text-pm-near-black">Crea nuovo ciclo</p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Titolo *
          </label>
          <input
            name="title"
            required
            placeholder="es. Ordine frutta 03/05"
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Chiusura ordini *
            </label>
            <input
              name="orderCloseAt"
              type="datetime-local"
              required
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Data ritiro
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                name="pickupDate"
                type="datetime-local"
                className="flex-1 min-w-[150px] rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
              />
              <input
                name="pickupEndTime"
                type="time"
                className="w-24 shrink-0 rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Fornitore
            </label>
            <select
              name="supplierId"
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            >
              <option value="">— nessuno —</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Accesso
            </label>
            <select
              name="accessLevel"
              defaultValue="soci"
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            >
              <option value="admin">Solo Admin</option>
              <option value="soci">Soci Attivi</option>
              <option value="utenti">Tutti gli utenti</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Note
          </label>
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-pm-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {isPending ? "Creazione…" : "Crea ciclo"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-pm-border px-4 py-2 text-[13px] font-semibold text-pm-gray"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}

// ── Close Cycle Button ────────────────────────────────────────────────────────

export function CloseCycleButton({ cycleId, cycleTitle }: { cycleId: string; cycleTitle: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (
      !window.confirm(
        `Chiudere "${cycleTitle}"?\n\nVerranno generati gli addebiti per tutti i soci con ordini.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await adminCloseCycle(cycleId);
        toast.success(`Ciclo chiuso. ${result.chargesGenerated} addebiti generati.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  return (
    <button
      onClick={handleClose}
      disabled={isPending}
      className="rounded-xl border border-pm-red/30 bg-pm-red-light px-4 py-2 text-[12px] font-bold text-pm-red disabled:opacity-60"
    >
      {isPending ? "Chiusura…" : "Chiudi ciclo"}
    </button>
  );
}

// ── Cycle Product Picker ──────────────────────────────────────────────────────

import { adminGetCatalogBySupplier, adminGetCycleProducts, adminRemoveProductFromCycle, adminLoadFromCatalog } from "@/lib/actions/admin";

type CycleProduct = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unitPrice: string;
  unit: string | null;
  supplierName: string | null;
};

export function CycleProductPicker({
  cycleId,
  suppliers,
}: {
  cycleId: string;
  suppliers: Supplier[];
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [catalog, setCatalog] = useState<CatalogProductItem[]>([]);
  const [currentProducts, setCurrentProducts] = useState<CycleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Load current products in cycle
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const prods = await adminGetCycleProducts(cycleId);
      setCurrentProducts(prods as CycleProduct[]);
      if (selectedSupplierId) {
        const cat = await adminGetCatalogBySupplier(selectedSupplierId);
        setCatalog(cat as CatalogProductItem[]);
      }
    } catch {
      toast.error("Errore nel caricamento prodotti");
    } finally {
      setLoading(false);
    }
  }, [cycleId, selectedSupplierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleAdd(catalogProductId: string) {
    startTransition(async () => {
      const result = await adminLoadFromCatalog(cycleId, [catalogProductId]);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Prodotto aggiunto");
        refresh();
      }
    });
  }

  function handleRemove(productId: string) {
    if (!window.confirm("Rimuovere questo prodotto dal ciclo?")) return;
    startTransition(async () => {
      const result = await adminRemoveProductFromCycle(productId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Prodotto rimosso");
        refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-pm-near-black">Prodotti in questo ciclo</h4>
        <div className="text-[11px] text-pm-gray">{currentProducts.length} prodotti</div>
      </div>

      {currentProducts.length > 0 ? (
        <div className="space-y-4">
          {Array.from(new Set(currentProducts.map(p => p.supplierName || "Altro"))).map(sName => (
            <div key={sName} className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-pm-gray-light">
                {sName}
              </div>
              <div className="divide-y divide-pm-border rounded-lg border border-pm-border bg-white overflow-hidden shadow-sm">
                {currentProducts.filter(p => (p.supplierName || "Altro") === sName).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between p-2.5 hover:bg-pm-warm-white/30">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-pm-near-black">{p.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-pm-gray">
                        <span>{p.variant} {p.format && `(${p.format})`}</span>
                        <span className="font-mono font-bold text-pm-orange">
                          {formatEur(parseFloat(p.unitPrice))}{p.unit ? `/${p.unit}` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(p.productId)}
                      className="ml-2 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-pm-border py-4 text-center text-[12px] text-pm-gray">
          Nessun prodotto selezionato per questo ciclo.
        </div>
      )}

      <div className="mt-6 border-t border-pm-border pt-4">
        <h4 className="mb-3 text-[13px] font-bold text-pm-near-black">Aggiungi dal Catalogo</h4>
        <select
          value={selectedSupplierId}
          onChange={(e) => setSelectedSupplierId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
        >
          <option value="">— seleziona fornitore —</option>
          {suppliers.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {s.name}
            </option>
          ))}
        </select>

        {selectedSupplierId && (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-pm-gray text-[12px]">Caricamento catalogo...</div>
            ) : catalog.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto divide-y divide-pm-border rounded-lg border border-pm-border bg-[#fdfdfd]">
                {catalog.filter(cp => !currentProducts.some(p => p.name === cp.name && p.variant === cp.variant && p.format === cp.format)).map((cp) => (
                  <div key={cp.catalogProductId} className="flex items-center justify-between p-2.5 hover:bg-pm-warm-white/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-pm-near-black">{cp.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-pm-gray">
                        <span>{cp.variant} {cp.format && `(${cp.format})`}</span>
                        <span className="font-mono font-bold text-pm-orange">
                          {formatEur(parseFloat(cp.unitPrice))}{cp.unit ? `/${cp.unit}` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(cp.catalogProductId)}
                      className="ml-2 rounded-lg bg-pm-teal px-3 py-1 text-[10px] font-bold text-white hover:bg-pm-teal-dark"
                    >
                      Aggiungi
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-pm-gray text-[12px]">Nessun prodotto trovato a catalogo per questo fornitore.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

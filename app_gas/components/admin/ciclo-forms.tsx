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
import { CycleReviewCloseButton } from "./cycle-review-modal";
import { SupplierActionsDialog } from "./supplier-actions-dialog";

type Supplier = { supplierId: string; name: string };

type SerializedCycle = {
  cycleId: string;
  title: string;
  orderCloseAt: string | null;
  pickupDate: string | null;
  pickupEndTime: string | null;
  pickup2Date: string | null;
  pickup2EndTime: string | null;
  notes: string | null;
  supplierId: string | null;
  accessLevel: string;
  isOverdue: boolean;
  shippingMode: string;
  shippingCostPerMember: string | null;
  shippingTotal: string | null;
  status?: string;
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
      {/* On mobile (< sm) the title stacks above a wrapping button row so all
          four actions stay inside the card. On ≥sm we keep the previous
          side-by-side layout. */}
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-pm-teal-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pm-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-pm-teal" />
            Aperto
          </span>
          <h3 className="mt-1 text-[15px] font-bold text-pm-near-black">{cycle.title}</h3>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
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
          <CycleReviewCloseButton cycleId={cycle.cycleId} cycleTitle={cycle.title} />
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
                {cycle.pickup2Date ? "Ritiro 1: " : "Ritiro: "}
                <span className="font-semibold text-pm-near-black">
                  {new Date(cycle.pickupDate).toLocaleString("it-IT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {cycle.pickupEndTime && `–${cycle.pickupEndTime}`}
                </span>
              </div>
            )}
            {cycle.pickup2Date && (
              <div>
                Ritiro 2:{" "}
                <span className="font-semibold text-pm-near-black">
                  {new Date(cycle.pickup2Date).toLocaleString("it-IT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {cycle.pickup2EndTime && `–${cycle.pickup2EndTime}`}
                </span>
              </div>
            )}
            {cycle.shippingMode === "proportional" &&
              cycle.shippingTotal &&
              parseFloat(cycle.shippingTotal) > 0 && (
                <div>
                  Spedizione:{" "}
                  <span className="font-semibold text-pm-near-black">
                    {parseFloat(cycle.shippingTotal).toFixed(2).replace(".", ",")} € totali (proporzionale al valore ordine)
                  </span>
                </div>
              )}
            {cycle.shippingMode !== "proportional" &&
              cycle.shippingCostPerMember &&
              parseFloat(cycle.shippingCostPerMember) > 0 && (
                <div>
                  Spedizione:{" "}
                  <span className="font-semibold text-pm-near-black">
                    {parseFloat(cycle.shippingCostPerMember).toFixed(2).replace(".", ",")} €/socio
                  </span>
                </div>
              )}
          </div>
          <div className="mt-3">
            <ClosedCycleDetails
              cycleId={cycle.cycleId}
              cycleTitle={cycle.title}
              buttonLabel="✎ Recap ordini"
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

function buildDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

const inputCls = "rounded-lg border border-pm-border px-2 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray";
const miniLabelCls = "shrink-0 text-[11px] font-medium text-pm-gray";

// Shared shipping section: a segmented switch between flat per-member fee
// and proportional split, with the relevant input rendered below.
function ShippingModeFields({
  mode,
  onModeChange,
  defaultPerMember,
  defaultTotal,
}: {
  mode: "fixed_per_member" | "proportional";
  onModeChange: (mode: "fixed_per_member" | "proportional") => void;
  defaultPerMember: string;
  defaultTotal: string;
}) {
  return (
    <div>
      <label className={labelCls}>Spedizione</label>
      <div className="mb-2 flex rounded-lg bg-black/[0.05] p-0.5">
        {(
          [
            { v: "fixed_per_member", label: "Fissa €/socio" },
            { v: "proportional", label: "Proporzionale" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onModeChange(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
              mode === opt.v
                ? "bg-white text-pm-near-black shadow-sm"
                : "bg-transparent text-pm-gray"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === "fixed_per_member" ? (
        <div>
          <input
            name="shippingCostPerMember"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultPerMember}
            placeholder="0.00"
            className={`w-full ${inputCls}`}
          />
          <p className="mt-1 text-[10px] text-pm-gray-light">
            Importo addebitato a ogni socio con un ordine.
          </p>
          {/* Hidden so the form data shape stays uniform across modes. */}
          <input type="hidden" name="shippingTotal" value="" />
        </div>
      ) : (
        <div>
          <input
            name="shippingTotal"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultTotal}
            placeholder="0.00"
            className={`w-full ${inputCls}`}
          />
          <p className="mt-1 text-[10px] text-pm-gray-light">
            Costo totale spedizione: viene diviso tra i soci in proporzione al valore del loro ordine.
          </p>
          <input type="hidden" name="shippingCostPerMember" value="" />
        </div>
      )}
    </div>
  );
}

export function EditCycleForm({
  cycle,
  suppliers,
  onClose,
  isClosed = false,
}: {
  cycle: SerializedCycle;
  suppliers: Supplier[];
  onClose: () => void;
  isClosed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // "manual" means the cycle is being driven by a supplier-distinta import:
  // shipping_charge ledger entries are per-member and the recompute is
  // suppressed (see adminUpdateCycle / recomputeShippingForClosedCycle).
  // The toggle is hidden in that mode — the admin sees a banner instead.
  const [shippingMode, setShippingMode] = useState<
    "fixed_per_member" | "proportional" | "manual"
  >(
    cycle.shippingMode === "proportional"
      ? "proportional"
      : cycle.shippingMode === "manual"
      ? "manual"
      : "fixed_per_member",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // On a closed cycle we deliberately skip fields that don't make sense to
    // change post-closure (orderCloseAt, supplierId, accessLevel). Those inputs
    // are also disabled visually so the user doesn't expect them to apply.
    const basePatch = {
      title: fd.get("title") as string,
      pickupDate: buildDateTime(fd.get("pickupDateOnly") as string, fd.get("pickupStartTime") as string),
      pickupEndTime: fd.get("pickupEndTime") as string,
      pickup2Date: buildDateTime(fd.get("pickup2DateOnly") as string, fd.get("pickup2StartTime") as string),
      pickup2EndTime: fd.get("pickup2EndTime") as string,
      notes: fd.get("notes") as string,
      shippingMode,
      shippingCostPerMember: fd.get("shippingCostPerMember") as string,
      shippingTotal: fd.get("shippingTotal") as string,
    };
    const openOnlyPatch = isClosed
      ? {}
      : {
          orderCloseAt: fd.get("orderCloseAt") as string,
          supplierId: fd.get("supplierId") as string,
          accessLevel: fd.get("accessLevel") as string,
        };
    startTransition(async () => {
      const result = await adminUpdateCycle(cycle.cycleId, {
        ...basePatch,
        ...openOnlyPatch,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (isClosed && result.adjustedMembers && result.adjustedMembers > 0) {
        toast.success(
          `Ciclo aggiornato — ricalcolata spedizione per ${result.adjustedMembers} soci`,
        );
      } else {
        toast.success("Ciclo aggiornato");
      }
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isClosed && (
        <div className="rounded-lg border border-pm-orange/30 bg-pm-orange-light px-3 py-2 text-[12px] leading-snug text-pm-near-black">
          <strong>Stai modificando un ciclo gia&apos; chiuso.</strong> Le modifiche
          alle spese di spedizione ricalcoleranno gli addebiti dei soci e
          invieranno una notifica di rettifica. Chiusura ordini, fornitore e
          livello di accesso non sono modificabili a ciclo chiuso.
        </div>
      )}
      <div>
        <label className={labelCls}>Titolo *</label>
        <input
          name="title"
          required
          defaultValue={cycle.title}
          className={`w-full ${inputCls}`}
        />
      </div>

      {!isClosed && (
        <div>
          <label className={labelCls}>Chiusura ordini *</label>
          <input
            name="orderCloseAt"
            type="datetime-local"
            required
            defaultValue={cycle.orderCloseAt?.slice(0, 16) ?? ""}
            className={`w-full ${inputCls}`}
          />
        </div>
      )}

      {shippingMode === "manual" ? (
        <div>
          <label className={labelCls}>Spedizione</label>
          <div className="rounded-xl border border-pm-orange/30 bg-pm-orange-light p-3 text-[12px] text-pm-near-black">
            <div className="font-bold text-pm-orange">Gestita manualmente per socio</div>
            <p className="mt-1 text-pm-gray">
              Le quote di spedizione sono state importate dalla distinta fornitore e variano per socio.
              Le voci nel saldo dei soci restano invariate finché non carichi una nuova distinta.
            </p>
          </div>
          <input type="hidden" name="shippingCostPerMember" value="" />
          <input type="hidden" name="shippingTotal" value="" />
        </div>
      ) : (
        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember={cycle.shippingCostPerMember ?? ""}
          defaultTotal={cycle.shippingTotal ?? ""}
        />
      )}


      {/* Ritiri: due righe allineate verticalmente */}
      <div>
        <label className={labelCls}>Ritiri (opzionale)</label>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-[46px] shrink-0 text-[12px] font-semibold text-pm-near-black`}>Ritiro 1</span>
            <input
              name="pickupDateOnly"
              type="date"
              defaultValue={cycle.pickupDate?.slice(0, 10) ?? ""}
              className={`w-[130px] shrink-0 ${inputCls}`}
            />
            <span className={miniLabelCls}>Dalle</span>
            <input
              name="pickupStartTime"
              type="time"
              defaultValue={cycle.pickupDate?.slice(11, 16) ?? ""}
              className={`flex-1 min-w-[72px] ${inputCls}`}
            />
            <span className={miniLabelCls}>Alle</span>
            <input
              name="pickupEndTime"
              type="time"
              defaultValue={cycle.pickupEndTime ?? ""}
              className={`flex-1 min-w-[72px] ${inputCls}`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-[46px] shrink-0 text-[12px] font-semibold text-pm-near-black`}>Ritiro 2</span>
            <input
              name="pickup2DateOnly"
              type="date"
              defaultValue={cycle.pickup2Date?.slice(0, 10) ?? ""}
              className={`w-[130px] shrink-0 ${inputCls}`}
            />
            <span className={miniLabelCls}>Dalle</span>
            <input
              name="pickup2StartTime"
              type="time"
              defaultValue={cycle.pickup2Date?.slice(11, 16) ?? ""}
              className={`flex-1 min-w-[72px] ${inputCls}`}
            />
            <span className={miniLabelCls}>Alle</span>
            <input
              name="pickup2EndTime"
              type="time"
              defaultValue={cycle.pickup2EndTime ?? ""}
              className={`flex-1 min-w-[72px] ${inputCls}`}
            />
          </div>
        </div>
      </div>

      {!isClosed && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fornitore</label>
            <select
              name="supplierId"
              defaultValue={cycle.supplierId ?? ""}
              className={`w-full ${inputCls}`}
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
            <label className={labelCls}>Accesso</label>
            <select
              name="accessLevel"
              defaultValue={cycle.accessLevel}
              className={`w-full ${inputCls}`}
            >
              <option value="admin">Solo Admin</option>
              <option value="soci">Soci Attivi</option>
              <option value="utenti">Tutti gli utenti</option>
            </select>
          </div>
        </div>
      )}
      <div>
        <label className={labelCls}>Note</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={cycle.notes ?? ""}
          className={`w-full ${inputCls}`}
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
  const [shippingMode, setShippingMode] = useState<"fixed_per_member" | "proportional">(
    "fixed_per_member",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: CreateCycleInput = {
      title: fd.get("title") as string,
      pickupDate: buildDateTime(fd.get("pickupDateOnly") as string, fd.get("pickupStartTime") as string),
      pickupEndTime: fd.get("pickupEndTime") as string,
      pickup2Date: buildDateTime(fd.get("pickup2DateOnly") as string, fd.get("pickup2StartTime") as string),
      pickup2EndTime: fd.get("pickup2EndTime") as string,
      orderCloseAt: fd.get("orderCloseAt") as string,
      supplierId: fd.get("supplierId") as string,
      accessLevel: fd.get("accessLevel") as string,
      notes: fd.get("notes") as string,
      shippingMode,
      shippingCostPerMember: fd.get("shippingCostPerMember") as string,
      shippingTotal: fd.get("shippingTotal") as string,
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
          <label className={labelCls}>Titolo *</label>
          <input
            name="title"
            required
            placeholder="es. Ordine frutta 03/05"
            className={`w-full ${inputCls}`}
          />
        </div>

        <div>
          <label className={labelCls}>Chiusura ordini *</label>
          <input
            name="orderCloseAt"
            type="datetime-local"
            required
            className={`w-full ${inputCls}`}
          />
        </div>

        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember=""
          defaultTotal=""
        />

        {/* Ritiri: due righe allineate verticalmente */}
        <div>
          <label className={labelCls}>Ritiri (opzionale)</label>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="w-[46px] shrink-0 text-[12px] font-semibold text-pm-near-black">Ritiro 1</span>
              <input name="pickupDateOnly" type="date" className={`w-[130px] shrink-0 ${inputCls}`} />
              <span className={miniLabelCls}>Dalle</span>
              <input name="pickupStartTime" type="time" className={`flex-1 min-w-[72px] ${inputCls}`} />
              <span className={miniLabelCls}>Alle</span>
              <input name="pickupEndTime" type="time" className={`flex-1 min-w-[72px] ${inputCls}`} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-[46px] shrink-0 text-[12px] font-semibold text-pm-near-black">Ritiro 2</span>
              <input name="pickup2DateOnly" type="date" className={`w-[130px] shrink-0 ${inputCls}`} />
              <span className={miniLabelCls}>Dalle</span>
              <input name="pickup2StartTime" type="time" className={`flex-1 min-w-[72px] ${inputCls}`} />
              <span className={miniLabelCls}>Alle</span>
              <input name="pickup2EndTime" type="time" className={`flex-1 min-w-[72px] ${inputCls}`} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fornitore</label>
            <select name="supplierId" className={`w-full ${inputCls}`}>
              <option value="">— nessuno —</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Accesso</label>
            <select name="accessLevel" defaultValue="soci" className={`w-full ${inputCls}`}>
              <option value="admin">Solo Admin</option>
              <option value="soci">Soci Attivi</option>
              <option value="utenti">Tutti gli utenti</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Note</label>
          <textarea
            name="notes"
            rows={2}
            className={`w-full ${inputCls}`}
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
                          {formatEur(parseFloat(p.unitPrice))}
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
                          {formatEur(parseFloat(cp.unitPrice))}
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

// ── Supplier Actions Button ──────────────────────────────────────────────────

// Opens the SupplierActionsDialog hub with three sections: scarica xlsx,
// invia mail, carica distinta compilata. Disabled (with explanatory
// tooltip) when the cycle has no supplier or no supplier email on file —
// download still works without an email but the mail section needs both.
export function SupplierActionsButton({
  cycleId,
  cycleTitle,
  supplierName,
  supplierEmail,
}: {
  cycleId: string;
  cycleTitle: string;
  supplierName: string | null;
  supplierEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const disabledReason = !supplierName
    ? "Ciclo senza fornitore"
    : !supplierEmail
      ? "Fornitore senza email"
      : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!!disabledReason}
        title={disabledReason ?? undefined}
        className="rounded-lg bg-pm-teal/10 px-3 py-1 text-[11px] font-bold text-pm-teal hover:bg-pm-teal/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        🤝 Fornitore
      </button>
      {open && (
        <SupplierActionsDialog
          open={open}
          onOpenChange={setOpen}
          cycleId={cycleId}
          cycleTitle={cycleTitle}
        />
      )}
    </>
  );
}

// ── Closed Cycle Edit Button ─────────────────────────────────────────────────

// Lightweight wrapper that opens EditCycleForm in a modal for a closed cycle.
// Reuses the same form to avoid drift; the form itself adapts via the
// `isClosed` flag (warning banner + locked fields + ledger recompute).
export function ClosedCycleEditButton({
  cycle,
  suppliers,
}: {
  cycle: SerializedCycle;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-pm-orange/10 px-3 py-1 text-[11px] font-bold text-pm-orange hover:bg-pm-orange/20"
      >
        ✎ Modifica
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[600px] flex-col rounded-2xl bg-pm-warm-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-pm-border p-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-pm-orange">
              Ciclo chiuso
            </div>
            <h3 className="mt-1 text-[16px] font-black text-pm-near-black">{cycle.title}</h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full bg-pm-border p-2 text-pm-gray hover:bg-pm-gray-light"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <EditCycleForm
            cycle={cycle}
            suppliers={suppliers}
            onClose={() => setOpen(false)}
            isClosed
          />
        </div>
      </div>
    </div>
  );
}

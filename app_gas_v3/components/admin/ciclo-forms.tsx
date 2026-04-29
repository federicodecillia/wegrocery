"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminCloseCycle, adminCreateCycle, type CreateCycleInput } from "@/lib/actions/admin";

type Supplier = { supplierId: string; name: string };

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
      orderCloseAt: fd.get("orderCloseAt") as string,
      supplierId: fd.get("supplierId") as string,
      accessLevel: (fd.get("accessLevel") as "attivi" | "all") ?? "attivi",
      notes: fd.get("notes") as string,
    };
    startTransition(async () => {
      try {
        await adminCreateCycle(data);
        toast.success("Ciclo creato");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
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
            <input
              name="pickupDate"
              type="datetime-local"
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            />
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
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            >
              <option value="attivi">Solo attivi</option>
              <option value="all">Tutti i soci</option>
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

"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import {
  adminCloseCycle,
  adminCreateCycle,
  adminUpdateCycle,
  type CreateCycleInput,
} from "@/lib/actions/admin";
import { formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Supplier = { supplierId: string; name: string };

type SerializedCycle = {
  cycleId: string;
  title: string;
  orderCloseAt: string | null;
  pickupDate: string | null;
  notes: string | null;
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
          <EditCycleForm cycle={cycle} onClose={() => setEditing(false)} />
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
                </span>
              </div>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

// ── Edit Cycle Form ───────────────────────────────────────────────────────────

function EditCycleForm({ cycle, onClose }: { cycle: SerializedCycle; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await adminUpdateCycle(cycle.cycleId, {
          title: fd.get("title") as string,
          pickupDate: fd.get("pickupDate") as string,
          orderCloseAt: fd.get("orderCloseAt") as string,
          notes: fd.get("notes") as string,
        });
        toast.success("Ciclo aggiornato");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
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
          <input
            name="pickupDate"
            type="datetime-local"
            defaultValue={cycle.pickupDate?.slice(0, 16) ?? ""}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
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

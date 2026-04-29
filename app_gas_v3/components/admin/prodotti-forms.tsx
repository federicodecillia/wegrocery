"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminLoadProducts, adminDuplicateProducts } from "@/lib/actions/admin";

type CycleOption = { cycleId: string; title: string };

// ── Load from text ────────────────────────────────────────────────────────────

export function LoadProductsForm({ cycleId }: { cycleId: string }) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await adminLoadProducts(cycleId, text);
        toast.success(`${result.count} prodotti caricati`);
        setText("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore nel parsing");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <p className="mb-1 text-[13px] font-bold text-pm-near-black">Carica prodotti da testo</p>
      <p className="mb-3 font-mono text-[10px] text-pm-teal">
        Formato: Nome;Varietà;Formato;Prezzo;Fornitore;Note
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"Carota;;500 g;1.75;Biofattoria Rossi;\nMela;Golden;1 kg;2.50;;"}
        className="w-full rounded-lg border border-pm-border px-3 py-2 font-mono text-[12px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
      />
      <button
        type="submit"
        disabled={isPending || !text.trim()}
        className="mt-3 w-full rounded-xl bg-pm-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Caricamento…" : "Carica prodotti"}
      </button>
    </form>
  );
}

// ── Duplicate from cycle ──────────────────────────────────────────────────────

export function DuplicateProductsForm({
  cycleId,
  pastCycles,
}: {
  cycleId: string;
  pastCycles: CycleOption[];
}) {
  const [sourceCycleId, setSourceCycleId] = useState(pastCycles[0]?.cycleId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    if (!sourceCycleId) return;
    if (!window.confirm("Sostituire i prodotti correnti con quelli del ciclo selezionato?")) return;
    startTransition(async () => {
      try {
        const result = await adminDuplicateProducts(sourceCycleId, cycleId);
        toast.success(`${result.count} prodotti duplicati`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  if (pastCycles.length === 0) return null;

  return (
    <div className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <p className="mb-3 text-[13px] font-bold text-pm-near-black">Duplica da ciclo precedente</p>
      <select
        value={sourceCycleId}
        onChange={(e) => setSourceCycleId(e.target.value)}
        className="mb-3 w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
      >
        {pastCycles.map((c) => (
          <option key={c.cycleId} value={c.cycleId}>
            {c.title}
          </option>
        ))}
      </select>
      <button
        onClick={handleDuplicate}
        disabled={isPending || !sourceCycleId}
        className="w-full rounded-xl bg-pm-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Duplicazione…" : "Duplica prodotti"}
      </button>
    </div>
  );
}

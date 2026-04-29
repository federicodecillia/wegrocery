"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminDeleteLedgerEntry, adminRecordTopup, adminUpdateLedgerEntry } from "@/lib/actions/admin";

type Member = { memberId: string; fullName: string };

// ── Topup Form ────────────────────────────────────────────────────────────────

export function TopupForm({ members }: { members: Member[] }) {
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const memberId = fd.get("memberId") as string;
    const amount = parseFloat(fd.get("amount") as string);
    const note = fd.get("note") as string;
    const entryDate = fd.get("entryDate") as string;

    if (!memberId || isNaN(amount) || amount <= 0) {
      toast.error("Seleziona un socio e inserisci un importo valido");
      return;
    }

    startTransition(async () => {
      try {
        await adminRecordTopup(memberId, amount, note, entryDate);
        toast.success(`Ricarica di €${amount.toFixed(2)} registrata`);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <p className="mb-3 text-[13px] font-bold text-pm-near-black">Nuova ricarica</p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Socio *
          </label>
          <select
            name="memberId"
            required
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
          >
            <option value="">— seleziona —</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Importo € *
            </label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0,00"
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Data
            </label>
            <input
              name="entryDate"
              type="date"
              defaultValue={today}
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Nota
          </label>
          <input
            name="note"
            placeholder="Ricarica"
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-teal/30"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-pm-teal py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Registrazione…" : "Registra ricarica"}
      </button>
    </form>
  );
}

// ── Ledger Entry Row ──────────────────────────────────────────────────────────

type LedgerEntry = {
  entryId: string;
  type: string;
  amount: string;
  note: string | null;
  entryDate: Date | null;
  cycleTitle?: string | null;
};

export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(Math.abs(parseFloat(entry.amount)).toFixed(2));
  const [note, setNote] = useState(entry.note ?? "");
  const [isPending, startTransition] = useTransition();

  const isTopup = entry.type === "topup";
  const isCharge = entry.type === "order_charge";

  function handleSave() {
    const newAmount = isTopup ? parseFloat(amount) : -parseFloat(amount);
    startTransition(async () => {
      try {
        await adminUpdateLedgerEntry(entry.entryId, { amount: newAmount, note });
        toast.success("Voce aggiornata");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Eliminare questa voce del ledger?")) return;
    startTransition(async () => {
      try {
        await adminDeleteLedgerEntry(entry.entryId);
        toast.success("Voce eliminata");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  const amountNum = parseFloat(entry.amount);

  if (editing) {
    return (
      <div className="bg-pm-orange-light px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 rounded-lg border border-pm-border px-2 py-1 font-mono text-[12px]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="nota"
            className="flex-1 rounded-lg border border-pm-border px-2 py-1 text-[12px]"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-pm-teal px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
          >
            Salva
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-pm-border px-3 py-1 text-[11px] text-pm-gray"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <span
          className={`mr-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
            isTopup
              ? "bg-pm-teal-light text-pm-teal"
              : isCharge
                ? "bg-pm-red-light text-pm-red"
                : "bg-black/[0.05] text-pm-gray"
          }`}
        >
          {isTopup ? "ricarica" : isCharge ? "addebito" : entry.type}
        </span>
        <span className="text-[12px] text-pm-gray">
          {entry.cycleTitle ? (
            <span className="font-medium text-pm-near-black">{entry.cycleTitle}</span>
          ) : (
            entry.note ?? "—"
          )}
          {entry.cycleTitle && entry.note && entry.note !== "Addebito ordine" && (
            <span className="ml-1 text-pm-gray-light">· {entry.note}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-[13px] font-bold ${amountNum >= 0 ? "text-pm-teal" : "text-pm-red"}`}
        >
          {amountNum >= 0 ? "+" : ""}
          {amountNum.toFixed(2).replace(".", ",")}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="rounded px-1.5 py-0.5 text-[10px] text-pm-gray hover:text-pm-near-black"
        >
          ✏
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded px-1.5 py-0.5 text-[10px] text-pm-red disabled:opacity-40"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

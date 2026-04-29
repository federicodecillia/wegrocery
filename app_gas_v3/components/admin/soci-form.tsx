"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminUpsertMember, type UpsertMemberInput } from "@/lib/actions/admin";

type Member = {
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
};

export function SociForm({ member, onClose }: { member?: Member; onClose?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const isEdit = !!member;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: UpsertMemberInput = {
      memberId: member?.memberId,
      fullName: fd.get("fullName") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as string,
      active: fd.get("active") === "true",
    };
    startTransition(async () => {
      try {
        await adminUpsertMember(data);
        toast.success(isEdit ? "Socio aggiornato" : "Socio aggiunto");
        onClose?.();
        if (!isEdit) (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-pm-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-pm-near-black">
          {isEdit ? `Modifica: ${member.fullName}` : "Aggiungi socio"}
        </p>
        {isEdit && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-pm-gray"
          >
            ✕ Annulla
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Nome *
          </label>
          <input
            name="fullName"
            required
            defaultValue={member?.fullName}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
            Email *
          </label>
          <input
            name="email"
            type="email"
            required
            defaultValue={member?.email}
            className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Ruolo
            </label>
            <select
              name="role"
              defaultValue={member?.role ?? "socio"}
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            >
              <option value="admin">Admin</option>
              <option value="attivo">Attivo</option>
              <option value="socio">Socio</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-pm-gray">
              Stato
            </label>
            <select
              name="active"
              defaultValue={String(member?.active ?? true)}
              className="w-full rounded-lg border border-pm-border px-3 py-2 text-[13px] text-pm-near-black focus:outline-none focus:ring-2 focus:ring-pm-orange/30"
            >
              <option value="true">Attivo</option>
              <option value="false">Inattivo</option>
            </select>
          </div>
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-pm-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? "Salvataggio…" : isEdit ? "Aggiorna socio" : "Aggiungi socio"}
      </button>
    </form>
  );
}

// ── Member list with inline edit ──────────────────────────────────────────────

export function SociList({ members }: { members: Member[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const attivi = members.filter((m) => m.role !== "socio" || m.active);
  const soci = members.filter((m) => m.role === "socio");

  function renderGroup(label: string, list: Member[]) {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-pm-gray-light">
          {label}
        </p>
        <div className="divide-y divide-pm-border rounded-xl border border-pm-border bg-white shadow-sm">
          {list.map((m) =>
            editingId === m.memberId ? (
              <div key={m.memberId} className="p-4">
                <SociForm member={m} onClose={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={m.memberId} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-pm-near-black">{m.fullName}</span>
                    {!m.active && (
                      <span className="rounded-full bg-pm-red-light px-1.5 py-0.5 text-[9px] font-bold text-pm-red">
                        inattivo
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-pm-gray-light">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      m.role === "admin"
                        ? "bg-pm-orange-light text-pm-orange"
                        : m.role === "attivo"
                          ? "bg-pm-teal-light text-pm-teal"
                          : "bg-black/[0.05] text-pm-gray"
                    }`}
                  >
                    {m.role}
                  </span>
                  <button
                    onClick={() => setEditingId(m.memberId)}
                    className="rounded-full border border-pm-border px-2.5 py-1 text-[10px] font-semibold text-pm-gray"
                  >
                    Modifica
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderGroup(`Attivi / Admin (${attivi.length})`, attivi)}
      {renderGroup(`Soci (${soci.length})`, soci)}
    </div>
  );
}

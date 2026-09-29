"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminDeleteLedgerEntry, adminUpdateLedgerEntry } from "@/lib/actions/admin";
import { formatDate, formatEur } from "@/lib/utils";
import { getRoleLabel } from "@/lib/roles";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { MANUAL_PAYMENT_METHODS, applyOriginalSign, isAdminEditableLedgerType } from "@/lib/ledger";
import type { LedgerEntryItem, MemberWithBalance } from "@/lib/db/queries";

// ── Summary Cards ─────────────────────────────────────────────────────────────

export function CassaSummaryCards({
  totalBalance,
  avgBalance,
  negativeCount,
  activeFilter,
}: {
  totalBalance: number;
  avgBalance: number;
  negativeCount: number;
  activeFilter: "negative" | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function toggleNegative() {
    const params = new URLSearchParams({ tab: "cassa" });
    if (activeFilter !== "negative") params.set("balance", "negative");
    // Preserve no other params — the cassa tab only honors `balance`.
    router.push(`/admin?${params}`);
    void sp; // referenced to make the hook participate in re-render on URL change
  }

  const total = (
    <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-light p-3">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray">
          {t.admin.treasury.totalBalance}
        </span>
        <span className="text-[14px] leading-none">💰</span>
      </div>
      <div
        className={`text-[18px] font-black tracking-[-0.02em] ${
          totalBalance >= 0 ? "text-brand-near-black" : "text-brand-red"
        }`}
      >
        {formatEur(totalBalance)}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
        {t.admin.treasury.activeMembersHint}
      </div>
    </div>
  );

  const avg = (
    <div className="rounded-xl border border-brand-border bg-white p-3">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray">
          {t.admin.treasury.avgBalance}
        </span>
        <span className="text-[14px] leading-none">📊</span>
      </div>
      <div
        className={`text-[18px] font-black tracking-[-0.02em] ${
          avgBalance >= 0 ? "text-brand-near-black" : "text-brand-red"
        }`}
      >
        {formatEur(avgBalance)}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
        {t.admin.treasury.perActiveMember}
      </div>
    </div>
  );

  const isActive = activeFilter === "negative";
  const negative = (
    <button
      type="button"
      onClick={toggleNegative}
      aria-pressed={isActive}
      className={`text-left rounded-xl border p-3 transition-transform active:scale-[0.98] ${
        isActive
          ? "border-brand-red bg-brand-red-light ring-2 ring-brand-red/40"
          : negativeCount > 0
            ? "border-brand-red/30 bg-brand-red-light"
            : "border-brand-border bg-white"
      }`}
    >
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray">
          {t.admin.treasury.negativeBalance}
        </span>
        <span className="text-[14px] leading-none">💸</span>
      </div>
      <div className="text-[18px] font-black tracking-[-0.02em] text-brand-near-black">
        {negativeCount}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-brand-gray-light">
        {isActive ? t.admin.treasury.filterActive : t.admin.treasury.filterHint}
      </div>
    </button>
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {total}
      {avg}
      {negative}
    </div>
  );
}

// ── Ledger Entry Row ──────────────────────────────────────────────────────────

type LedgerEntry = {
  entryId: string;
  type: string;
  amount: string;
  note: string | null;
  entryDate: string | null;
  cycleTitle?: string | null;
  paymentId?: string | null;
  method?: string | null;
  externalRef?: string | null;
};

// "Bonifico · CRO…" for a manual movement, "Online" for a Stripe row (credit
// or refund), "" when the row records neither.
function movementDetails(entry: LedgerEntry): string {
  if (entry.paymentId) return t.admin.treasury.methodOnline;
  const method = MANUAL_PAYMENT_METHODS.find((m) => m === entry.method);
  return [method ? t.admin.treasury.methods[method] : entry.method, entry.externalRef]
    .filter(Boolean)
    .join(" · ");
}

export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(Math.abs(parseFloat(entry.amount)).toFixed(2));
  const [note, setNote] = useState(entry.note ?? "");
  const [isPending, startTransition] = useTransition();

  const isTopup = entry.type === "topup";
  const isCharge = entry.type === "order_charge";
  // Order/shipping charges are corrected from the cycle, never edited here;
  // online top-ups and their refunds follow the money on Stripe.
  const isEditable = isAdminEditableLedgerType(entry.type) && !entry.paymentId;

  function handleSave() {
    // Keep the entry's own sign: editing a refund's note must not flip it.
    // Invalid input becomes NaN and the server answers with a readable error.
    const newAmount = applyOriginalSign(entry.amount, amount);
    startTransition(async () => {
      const result = await adminUpdateLedgerEntry(entry.entryId, { amount: newAmount, note });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.treasury.entryUpdated);
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!window.confirm(t.admin.treasury.deleteConfirm)) return;
    startTransition(async () => {
      const result = await adminDeleteLedgerEntry(entry.entryId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.treasury.entryDeleted);
    });
  }

  const amountNum = parseFloat(entry.amount);
  const details = movementDetails(entry);

  if (editing && isEditable) {
    return (
      <div className="bg-brand-orange-light px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 rounded-lg border border-brand-border px-2 py-1 font-mono text-[12px]"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.admin.treasury.noteLabel}
            className="flex-1 rounded-lg border border-brand-border px-2 py-1 text-[12px]"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-brand-teal px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
          >
            {t.admin.common.save}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-brand-border px-3 py-1 text-[11px] text-brand-gray"
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
          className={`mr-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            isTopup
              ? "bg-brand-teal-light text-brand-teal"
              : isCharge
                ? "bg-brand-red-light text-brand-red"
                : "bg-black/[0.05] text-brand-gray"
          }`}
        >
          {isTopup ? t.admin.treasury.topupBadge : isCharge ? t.admin.treasury.chargeBadge : entry.type}
        </span>
        <span className="text-[12px] text-brand-gray">
          {entry.cycleTitle ? (
            <span className="font-medium text-brand-near-black">{entry.cycleTitle}</span>
          ) : (
            entry.note ?? (details ? null : "—")
          )}
          {entry.cycleTitle && entry.note && entry.note !== t.ledger.orderCharge && (
            <span className="ml-1 text-brand-gray-light">· {entry.note}</span>
          )}
        </span>
        {details && <div className="mt-0.5 break-all font-mono text-[10px] text-brand-gray-light">{details}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-[13px] font-bold ${amountNum >= 0 ? "text-brand-teal" : "text-brand-red"}`}
        >
          {amountNum >= 0 ? "+" : ""}
          {formatMoney(Math.abs(amountNum))}
        </span>
        {isEditable && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="rounded px-1.5 py-0.5 text-[10px] text-brand-gray hover:text-brand-near-black"
            >
              ✏
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded px-1.5 py-0.5 text-[10px] text-brand-red disabled:opacity-40"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Cassa Inline List ─────────────────────────────────────────────────────────

export function CassaInlineList({
  members,
  ledgerByMember,
  balanceFilter = null,
}: {
  members: MemberWithBalance[];
  ledgerByMember: Record<string, LedgerEntryItem[]>;
  balanceFilter?: "negative" | null;
}) {
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = members.filter((m) => {
    if (balanceFilter === "negative" && m.balance >= 0) return false;
    const q = filter.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="border-b border-brand-border px-4 py-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.admin.treasury.searchMember}
          className="w-full rounded-lg border border-brand-border px-3 py-1.5 text-[12px] text-brand-near-black placeholder:text-brand-gray-light focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
        />
      </div>
      <div className="divide-y divide-brand-border">
        {filtered.map((m) => {
          const entries = ledgerByMember[m.memberId] ?? [];
          const isExpanded = expandedId === m.memberId;
          return (
            <div key={m.memberId}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : m.memberId)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-brand-near-black">{m.fullName}</div>
                  <div className="font-mono text-[10px] text-brand-gray-light">
                    {getRoleLabel(m.role)}
                    {m.active ? "" : ` ${t.admin.treasury.inactiveHint}`} · {t.admin.treasury.movementsCount(entries.length)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[13px] font-bold ${
                      m.balance >= 0 ? "text-brand-teal" : "text-brand-red"
                    }`}
                  >
                    {m.balance >= 0 ? "+" : ""}
                    {formatMoney(Math.abs(m.balance))}
                  </span>
                  <span className="text-[11px] text-brand-gray-light">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-brand-border bg-black/[0.01]">
                  {entries.length === 0 ? (
                    <p className="px-4 py-3 text-center text-[12px] text-brand-gray">
                      {t.admin.treasury.noMovements}
                    </p>
                  ) : (
                    entries.map((entry) => (
                      <div key={entry.entryId}>
                        <div className="px-4 pt-2 font-mono text-[10px] text-brand-gray-light">
                          {entry.entryDate ? formatDate(entry.entryDate) : "—"}
                        </div>
                        <LedgerEntryRow entry={entry} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-[12px] text-brand-gray">
            {t.admin.treasury.noMemberFound}
          </p>
        )}
      </div>
    </div>
  );
}

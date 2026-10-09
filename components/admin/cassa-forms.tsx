"use client";

import { confirm } from "@/components/ui/confirm-dialog";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminDeleteLedgerEntry, adminUpdateLedgerEntry } from "@/lib/actions/admin";
import { formatDate, formatEur } from "@/lib/utils";
import { DEFAULT_ROLE, normalizeRole, type Role } from "@/lib/roles";
import { t } from "@/lib/i18n";
import { formatMoney, formatSignedMoney } from "@/lib/i18n/format";
import {
  MANUAL_PAYMENT_METHODS,
  applyOriginalSign,
  isAdminEditableLedgerType,
  isOutgoingLedgerType,
} from "@/lib/ledger";
import type { LedgerEntryItem, MemberWithBalance } from "@/lib/db/queries";
import { ledgerBadge } from "@/lib/ledger-badge";
import { movementKind } from "@/lib/movement-label";
import { MovementIcon } from "@/components/movement-icon";
import { isAboveMaxBalance } from "@/lib/payments/settings";
import { useWide } from "@/lib/ui/use-wide";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

// ── Summary Cards ─────────────────────────────────────────────────────────────

// The Cassa list filters, from ?balance= (app/admin/page.tsx).
export type BalanceFilter = "negative" | "above_max";

export function CassaSummaryCards({
  totalBalance,
  avgBalance,
  negativeCount,
  aboveMaxCount,
  activeFilter,
}: {
  totalBalance: number;
  avgBalance: number;
  negativeCount: number;
  // null when the group has no maximum balance: the card is hidden.
  aboveMaxCount: number | null;
  activeFilter: BalanceFilter | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function toggleFilter(filter: BalanceFilter) {
    const params = new URLSearchParams({ tab: "cassa" });
    if (activeFilter !== filter) params.set("balance", filter);
    // Preserve no other params — the cassa tab only honors `balance`.
    router.push(`/admin?${params}`);
    void sp; // referenced to make the hook participate in re-render on URL change
  }

  const total = (
    <div className="rounded-xl border border-accent/20 bg-accent-soft p-3">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-label uppercase tracking-wide text-brand-gray">
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
      <div className="mt-0.5 font-mono text-label text-muted">
        {t.admin.treasury.activeMembersHint}
      </div>
    </div>
  );

  const avg = (
    <div className="rounded-xl border border-brand-border bg-white p-3">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-label uppercase tracking-wide text-brand-gray">
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
      <div className="mt-0.5 font-mono text-label text-muted">
        {t.admin.treasury.perActiveMember}
      </div>
    </div>
  );

  const isActive = activeFilter === "negative";
  const negative = (
    <button
      type="button"
      onClick={() => toggleFilter("negative")}
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
        <span className="font-mono text-label uppercase tracking-wide text-brand-gray">
          {t.admin.treasury.negativeBalance}
        </span>
        <span className="text-[14px] leading-none">💸</span>
      </div>
      <div className="text-[18px] font-black tracking-[-0.02em] text-brand-near-black">
        {negativeCount}
      </div>
      <div className="mt-0.5 font-mono text-label text-muted">
        {isActive ? t.admin.treasury.filterActive : t.admin.treasury.filterHint}
      </div>
    </button>
  );

  const aboveMaxActive = activeFilter === "above_max";
  const aboveMax = aboveMaxCount !== null && (
    <button
      type="button"
      onClick={() => toggleFilter("above_max")}
      aria-pressed={aboveMaxActive}
      className={`text-left rounded-xl border p-3 transition-transform active:scale-[0.98] ${
        aboveMaxActive
          ? "border-primary bg-primary-soft ring-2 ring-primary/40"
          : aboveMaxCount > 0
            ? "border-primary/30 bg-primary-soft"
            : "border-brand-border bg-white"
      }`}
    >
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-label uppercase tracking-wide text-brand-gray">
          {t.admin.treasury.aboveMaxBalance}
        </span>
        <span className="text-[14px] leading-none">📈</span>
      </div>
      <div className="text-[18px] font-black tracking-[-0.02em] text-brand-near-black">{aboveMaxCount}</div>
      <div className="mt-0.5 font-mono text-label text-muted">
        {aboveMaxActive ? t.admin.treasury.filterActive : t.admin.treasury.filterHint}
      </div>
    </button>
  );

  return (
    <div className={`grid grid-cols-2 gap-2 ${aboveMaxCount === null ? "sm:grid-cols-3" : "lg:grid-cols-4"}`}>
      {total}
      {avg}
      {negative}
      {aboveMax}
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
  correctedAt?: string | null;
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
  const [draftNote, setDraftNote] = useState(entry.note ?? "");
  const [isPending, startTransition] = useTransition();

  // Order/shipping charges are corrected from the cycle, never edited here;
  // online top-ups and their refunds follow the money on Stripe.
  const isEditable = isAdminEditableLedgerType(entry.type) && !entry.paymentId;

  function handleSave() {
    // Keep the entry's own sign: editing a refund's note must not flip it.
    // Invalid input becomes NaN and the server answers with a readable error.
    const newAmount = applyOriginalSign(entry.amount, amount);
    startTransition(async () => {
      const result = await adminUpdateLedgerEntry(entry.entryId, { amount: newAmount, note: draftNote });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.treasury.entryUpdated);
      setEditing(false);
    });
  }

  async function handleDelete() {
    if (!(await confirm({ title: t.admin.treasury.deleteConfirm, danger: true }))) return;
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
  const movement = { ...entry, paymentId: entry.paymentId ?? null };
  const badge = ledgerBadge(movement, t.admin.treasury);
  const kindLabel = badge.label.charAt(0).toUpperCase() + badge.label.slice(1);
  // The cycle names the row when there is one; otherwise the note, else the kind.
  const title = entry.cycleTitle ?? entry.note ?? kindLabel;
  // A note that only repeats the kind ("Spedizione", "Addebito ordine") adds nothing.
  const repeatsKind = (n: string) => n === t.ledger.orderCharge || n.toLowerCase() === badge.label.toLowerCase();
  const note = entry.cycleTitle && entry.note && !repeatsKind(entry.note) ? entry.note : null;

  if (editing && isEditable) {
    return (
      <div className="space-y-2 bg-primary-soft px-4 py-3">
        <div className="text-[13px] font-medium text-brand-near-black">
          {title} <span className="font-mono text-label font-normal text-muted">· {kindLabel}</span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t.admin.treasury.amountLabel}
            className="min-h-11 w-28 shrink-0 rounded-lg border border-brand-border bg-white px-2 py-1 font-mono text-[14px]"
          />
          <input
            type="text"
            aria-label={isOutgoingLedgerType(entry.type) ? t.admin.treasury.reasonLabel : t.admin.treasury.noteLabel}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            // An outgoing movement's causale is required (the member sees it).
            placeholder={isOutgoingLedgerType(entry.type) ? t.admin.treasury.reasonLabel : t.admin.treasury.noteLabel}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-white px-2 py-1 text-[14px]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="min-h-11 px-4" onClick={() => setEditing(false)}>
            {t.admin.common.cancel}
          </Button>
          <Button size="sm" variant="accent" className="min-h-11 px-4" onClick={handleSave} disabled={isPending}>
            {t.admin.common.save}
          </Button>
        </div>
      </div>
    );
  }

  // One layout for every movement: icon, then the name with the signed amount
  // always on the right, then kind and day, then the note and the payment
  // details on lines of their own, and the actions last.
  return (
    <div className="flex gap-3 px-4 py-3">
      <MovementIcon kind={movementKind(movement)} incoming={amountNum >= 0} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-[14px] font-medium text-brand-near-black">{title}</span>
          <span
            className={`shrink-0 whitespace-nowrap font-mono text-[14px] font-bold tabular-nums ${
              amountNum >= 0 ? "text-accent-text" : "text-brand-red"
            }`}
          >
            {formatSignedMoney(entry.amount)}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-label text-muted">
          {kindLabel} · {entry.entryDate ? formatDate(entry.entryDate) : "—"}
          {entry.correctedAt && ` · ${t.ledger.correctedOn(formatDate(entry.correctedAt))}`}
        </div>
        {note && <p className="mt-1 text-[13px] text-brand-gray">{note}</p>}
        {details && <p className="mt-0.5 break-all font-mono text-label text-muted">{details}</p>}
        {isEditable && (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 px-4"
              onClick={() => setEditing(true)}
              aria-label={t.admin.treasury.editEntryAria}
            >
              {t.admin.common.edit}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 px-4 text-brand-red hover:bg-brand-red-light"
              onClick={handleDelete}
              disabled={isPending}
              aria-label={t.admin.treasury.deleteEntryAria}
            >
              {t.admin.common.delete}
            </Button>
          </div>
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
  maxBalance,
  openMemberId,
}: {
  members: MemberWithBalance[];
  ledgerByMember: Record<string, LedgerEntryItem[]>;
  balanceFilter?: BalanceFilter | null;
  maxBalance: number | null;
  /** From a member's page in Soci: their movements, open and in view. */
  openMemberId?: string;
}) {
  const [filter, setFilter] = useState("");
  // From lg the history opens under the row; on phones and tablets in a sheet,
  // like a movement in Storico.
  const wide = useWide();
  const [expandedId, setExpandedId] = useState<string | null>(openMemberId ?? null);
  const sheetMember = wide ? null : (members.find((m) => m.memberId === expandedId) ?? null);

  useEffect(() => {
    if (openMemberId) document.getElementById(`cassa-${openMemberId}`)?.scrollIntoView({ block: "start" });
  }, [openMemberId]);

  const filtered = members.filter((m) => {
    if (balanceFilter === "negative" && m.balance >= 0) return false;
    if (balanceFilter === "above_max" && !isAboveMaxBalance(m.balance, maxBalance)) return false;
    const q = filter.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  // Grouped by role like Admin → Soci. Legacy values fall under their
  // canonical role, an unknown one under the least-privileged group.
  const inGroup = (role: Role) => filtered.filter((m) => (normalizeRole(m.role) ?? DEFAULT_ROLE) === role);

  function renderEntries(entries: LedgerEntryItem[]) {
    if (entries.length === 0) {
      return <p className="px-4 py-3 text-center text-[12px] text-brand-gray">{t.admin.treasury.noMovements}</p>;
    }
    return (
      <div className="divide-y divide-brand-border">
        {entries.map((entry) => (
          <LedgerEntryRow key={entry.entryId} entry={entry} />
        ))}
      </div>
    );
  }

  function renderBalance(balance: number) {
    return (
      <span className={`font-mono text-[13px] font-bold ${balance >= 0 ? "text-accent-text" : "text-brand-red"}`}>
        {balance >= 0 ? "+" : ""}
        {formatMoney(Math.abs(balance))}
      </span>
    );
  }

  function renderRow(m: MemberWithBalance) {
    const entries = ledgerByMember[m.memberId] ?? [];
    const isExpanded = wide && expandedId === m.memberId;
    return (
      <div key={m.memberId} id={`cassa-${m.memberId}`} className="scroll-mt-20">
        <button
          onClick={() => setExpandedId(expandedId === m.memberId && wide ? null : m.memberId)}
          aria-expanded={wide ? isExpanded : undefined}
          aria-haspopup={wide ? undefined : "dialog"}
          className="flex min-h-14 w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-brand-near-black">{m.fullName}</div>
            <div className="font-mono text-label text-muted">
              {t.admin.treasury.movementsCount(entries.length)}
              {m.active ? "" : ` ${t.admin.treasury.inactiveHint}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {renderBalance(m.balance)}
            <span aria-hidden className="text-label text-muted">{wide ? (isExpanded ? "▲" : "▼") : "›"}</span>
          </div>
        </button>

        {isExpanded && <div className="border-t border-brand-border bg-black/[0.01]">{renderEntries(entries)}</div>}
      </div>
    );
  }

  function renderGroup(label: string, list: MemberWithBalance[]) {
    if (list.length === 0) return null;
    return (
      <div>
        <p className="border-b border-brand-border bg-black/[0.02] px-4 py-1.5 font-mono text-label uppercase tracking-wider text-muted">
          {label} ({list.length})
        </p>
        <div className="divide-y divide-brand-border">{list.map(renderRow)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-brand-border px-4 py-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t.admin.treasury.searchMember}
          aria-label={t.admin.treasury.searchMember}
          className="min-h-11 w-full rounded-lg border border-brand-border px-3 py-1.5 text-[14px] text-brand-near-black placeholder:text-muted"
        />
      </div>
      <div className="divide-y divide-brand-border">
        {renderGroup(t.roles.admin, inGroup("admin"))}
        {renderGroup(t.roles.attivi, inGroup("attivi"))}
        {renderGroup(t.roles.utenti, inGroup("utenti"))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-[12px] text-brand-gray">
            {t.admin.treasury.noMemberFound}
          </p>
        )}
      </div>

      <Sheet
        open={sheetMember !== null}
        onRequestClose={() => setExpandedId(null)}
        title={sheetMember?.fullName}
        subtitle={
          sheetMember && (
            <>
              {t.admin.treasury.movementsCount((ledgerByMember[sheetMember.memberId] ?? []).length)} ·{" "}
              {renderBalance(sheetMember.balance)}
            </>
          )
        }
        footer={<Button block onClick={() => setExpandedId(null)}>{t.common.close}</Button>}
      >
        {sheetMember && (
          <div className="-mx-4 -my-4">{renderEntries(ledgerByMember[sheetMember.memberId] ?? [])}</div>
        )}
      </Sheet>
    </div>
  );
}

import Link from "next/link";
import { MovementIcon } from "@/components/movement-icon";
import { t } from "@/lib/i18n";
import { formatSignedMoney } from "@/lib/i18n/format";
import { movementKind, movementText, type LedgerMovement } from "@/lib/movement-label";
import { formatDate, formatDateShort } from "@/lib/utils";

type Entry = LedgerMovement & { note: string | null; entryDate: Date | string; correctedAt?: Date | string | null };

/** "8 ott" this year, "8 ott 2025" before: the year only when it is not obvious. */
function movementDay(date: Date | string): string {
  const d = new Date(date);
  return d.getFullYear() === new Date().getFullYear() ? formatDateShort(d) : formatDate(d);
}

// One ledger movement, the same on Home (a link to Storico → Movimenti) and
// in Storico (a button that opens its detail): icon, label, day, signed amount.
export function MovementRow({
  entry,
  href,
  onSelect,
  selected = false,
  inset = false,
}: {
  entry: Entry;
  href?: string;
  onSelect?: () => void;
  /** From lg in Storico: the movement shown beside the list. */
  selected?: boolean;
  /** Inside a card: side padding. */
  inset?: boolean;
}) {
  const incoming = parseFloat(String(entry.amount)) >= 0;
  const className = `flex w-full items-center justify-between gap-3 border-b border-brand-border py-[12px] text-left last:border-none ${
    inset ? "px-4" : ""
  } ${selected ? "bg-primary-soft" : "hover:bg-black/[0.02]"}`;
  const body = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <MovementIcon kind={movementKind(entry)} incoming={incoming} />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-brand-near-black">{movementText(entry, t.history)}</span>
          <span className="mt-[2px] block font-mono text-label text-muted">
            {movementDay(entry.entryDate)}
            {entry.correctedAt && ` · ${t.ledger.correctedOn(formatDate(entry.correctedAt))}`}
          </span>
        </span>
      </span>
      <span className={`shrink-0 whitespace-nowrap font-mono text-[14px] font-bold tabular-nums ${incoming ? "text-accent-text" : "text-brand-red"}`}>
        {formatSignedMoney(entry.amount)}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} className={className}>
      {body}
    </button>
  );
}

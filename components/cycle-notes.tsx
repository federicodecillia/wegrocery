import { t } from "@/lib/i18n";

/** The admin's notes on a cycle (order_cycles.notes), shown to members on
 * Home and on the order page. Line breaks typed in the textarea are kept. */
export function CycleNotes({ notes, className = "" }: { notes: string | null | undefined; className?: string }) {
  const text = notes?.trim();
  if (!text) return null;
  return (
    <div className={`rounded-card border border-brand-border bg-white p-[12px_14px] ${className}`}>
      <div className="font-mono text-label uppercase tracking-[0.1em] text-muted">{t.order.cycleNotes}</div>
      <p className="mt-1 whitespace-pre-line break-words text-[14px] leading-[1.45] text-brand-near-black">{text}</p>
    </div>
  );
}

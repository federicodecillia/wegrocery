"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Sheet, SheetActions } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { labelClass } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { adminClearPickup, adminMarkPickup } from "@/lib/actions/admin-pickups";
import type { CyclePickupRow } from "@/lib/db/pickups";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";
import { PICKUP_COLLECTED_BY_MAX, PICKUP_NOTE_MAX, pickupProgressLabel } from "@/lib/pickups";
import { cn } from "@/lib/utils";

type Filter = "todo" | "done" | "all";
type Change = { memberId: string; pickedUpAt: string | null };

// Admin → Ciclo → Ritiri (closed cycle): every member with an order, a tick
// that marks the pickup now, and the name that opens the details (time, who
// collected, a note for the admins). The tick moves at once; the server
// actions revalidate /admin, so the rows come back as stored (the sheet's
// saves too).
export function CyclePickupsView({ cycleId, rows }: { cycleId: string; rows: CyclePickupRow[] }) {
  const p = t.admin.pickups;
  const [optimistic, apply] = useOptimistic(rows, (current: CyclePickupRow[], change: Change) =>
    current.map((r) => (r.memberId === change.memberId ? { ...r, pickedUpAt: change.pickedUpAt } : r)),
  );
  const done = optimistic.filter((r) => r.pickedUpAt).length;
  const [filter, setFilter] = useState<Filter>(() => (rows.some((r) => !r.pickedUpAt) ? "todo" : "all"));
  const [editing, setEditing] = useState<CyclePickupRow | null>(null);
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="rounded-2xl border border-border bg-card p-4 text-[13px] text-secondary-foreground">{p.empty}</p>;
  }

  const shown = optimistic.filter((r) => filter === "all" || (filter === "done") === Boolean(r.pickedUpAt));

  function toggle(row: CyclePickupRow) {
    // A pickup with details is taken off from its sheet, where they show.
    if (row.pickedUpAt && (row.note || row.collectedBy)) {
      setEditing(row);
      return;
    }
    startTransition(async () => {
      apply({ memberId: row.memberId, pickedUpAt: row.pickedUpAt ? null : new Date().toISOString() });
      const result = row.pickedUpAt
        ? await adminClearPickup({ cycleId, memberId: row.memberId })
        : await adminMarkPickup({ cycleId, memberId: row.memberId });
      if (result.error) toast.error(result.error);
      else toast.success(row.pickedUpAt ? p.cleared(row.fullName) : p.marked(row.fullName));
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-foreground">{pickupProgressLabel({ done, total: optimistic.length })}</p>
        <div role="group" aria-label={p.filterLabel} className="flex gap-1 rounded-full bg-tint/[0.05] p-1">
          {(["todo", "done", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-(--control-h) rounded-full px-3 text-label font-semibold",
                filter === f ? "bg-card text-foreground shadow-sm" : "text-secondary-foreground",
              )}
            >
              {p.filters[f]}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 max-w-prose text-[13px] text-secondary-foreground">{p.intro}</p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-[13px] text-secondary-foreground">
          {filter === "todo" ? p.noneTodo : p.noneDone}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {shown.map((row) => (
            <li key={row.memberId} className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={Boolean(row.pickedUpAt)}
                aria-label={row.pickedUpAt ? p.unmarkLabel(row.fullName) : p.markLabel(row.fullName)}
                onClick={() => toggle(row)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                    row.pickedUpAt ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background",
                  )}
                >
                  {row.pickedUpAt && <Check className="size-4" strokeWidth={3} aria-hidden />}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditing(row)}
                aria-label={p.editLabel(row.fullName)}
                className="min-h-11 min-w-0 flex-1 py-1 text-left"
              >
                <span className="block truncate text-[14px] font-semibold text-foreground">{row.fullName}</span>
                <span className="block text-label text-muted-foreground">
                  {[
                    p.lines(row.lines),
                    row.pickedUpAt && p.pickedUpAt(formatDateTime(row.pickedUpAt)),
                    row.collectedBy && p.collectedBy(row.collectedBy),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {row.note && <span className="mt-0.5 block line-clamp-2 text-label text-secondary-foreground">📝 {row.note}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PickupSheet
          key={editing.memberId}
          cycleId={cycleId}
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PickupSheet({
  cycleId,
  row,
  onClose,
}: {
  cycleId: string;
  row: CyclePickupRow;
  onClose: () => void;
}) {
  const p = t.admin.pickups;
  const [pickedUpAt, setPickedUpAt] = useState(row.pickedUpAt ? utcToZonedLocalInput(row.pickedUpAt) : "");
  const [collectedBy, setCollectedBy] = useState(row.collectedBy ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await adminMarkPickup({ cycleId, memberId: row.memberId, pickedUpAt, collectedBy, note });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(row.pickedUpAt ? p.saved : p.marked(row.fullName));
      onClose();
    });
  }

  function clear() {
    startTransition(async () => {
      const result = await adminClearPickup({ cycleId, memberId: row.memberId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(p.cleared(row.fullName));
      onClose();
    });
  }

  return (
    <Sheet
      open
      onRequestClose={() => !isPending && onClose()}
      title={p.sheetTitle(row.fullName)}
      subtitle={[
        p.lines(row.lines),
        row.pickedUpAt && p.pickedUpAt(formatDateTime(row.pickedUpAt)),
        row.recordedByName && p.recordedBy(row.recordedByName),
      ]
        .filter(Boolean)
        .join(" · ")}
      footer={
        <SheetActions>
          {row.pickedUpAt ? (
            <Button variant="outline" className="flex-1" onClick={clear} disabled={isPending}>
              {p.clear}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              {t.admin.common.cancel}
            </Button>
          )}
          <Button variant="brand" className="flex-1" onClick={save} disabled={isPending}>
            {row.pickedUpAt ? p.saveChanges : p.save}
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={labelClass}>{p.timeLabel}</span>
          <Input type="datetime-local" value={pickedUpAt} onChange={(e) => setPickedUpAt(e.target.value)} />
          <span className="mt-1 block text-label text-muted-foreground">{p.timeHint}</span>
        </label>
        <label className="block">
          <span className={labelClass}>{p.collectedByLabel}</span>
          <Input
            value={collectedBy}
            maxLength={PICKUP_COLLECTED_BY_MAX}
            placeholder={p.collectedByPlaceholder}
            onChange={(e) => setCollectedBy(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{p.noteLabel}</span>
          <Textarea rows={3} value={note} maxLength={PICKUP_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          <span className="mt-1 block text-label text-muted-foreground">{p.noteHint}</span>
        </label>
      </div>
    </Sheet>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet, SheetActions } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { adminMergeMembers, previewMemberMerge, type MergePreview } from "@/lib/actions/admin-members";
import { formatMoney } from "@/lib/i18n/format";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import { MemberCombobox, type PickerMember } from "./member-combobox";

// Admin -> Members -> Merge: one person, two accounts. The admin picks the
// account that stays; the server shows what will happen (previewMemberMerge)
// before anything is written. Rules in lib/members/merge.ts.
export function MergeMembersDialog({
  open,
  onOpenChange,
  members,
  absorbedId,
  survivorId,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  // Members that can take part in a merge (not already merged).
  members: ReadonlyArray<PickerMember>;
  absorbedId: string;
  survivorId?: string;
}) {
  const byId = (id: string | undefined) => members.find((m) => m.memberId === id) ?? null;
  const [absorbed, setAbsorbed] = useState<PickerMember | null>(() => byId(absorbedId));
  const [survivor, setSurvivor] = useState<PickerMember | null>(() => byId(survivorId));
  // undefined = the server's default choice.
  const [alias, setAlias] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const m = t.admin.members.merge;

  const survivorKey = survivor?.memberId;
  const absorbedKey = absorbed?.memberId;
  useEffect(() => {
    if (!open || !survivorKey || !absorbedKey) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    previewMemberMerge(survivorKey, absorbedKey, alias)
      .then((result) => {
        if (cancelled) return;
        setPreview(result.preview ?? null);
        setError(result.error ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(t.admin.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, survivorKey, absorbedKey, alias]);

  function swap() {
    setAlias(undefined);
    setSurvivor(absorbed);
    setAbsorbed(survivor);
  }

  function handleConfirm() {
    if (!survivor || !absorbed || !preview) return;
    startTransition(async () => {
      const result = await adminMergeMembers(survivor.memberId, absorbed.memberId, preview.alias);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(m.done(absorbed.fullName, survivor.fullName));
      onOpenChange(false);
    });
  }

  const candidates = members.filter((x) => x.memberId !== absorbed?.memberId);

  return (
    <Sheet
      open={open}
      onRequestClose={() => !isPending && onOpenChange(false)}
      title={m.title(absorbed?.fullName ?? "")}
      footer={
        <SheetActions>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t.admin.common.cancel}
          </Button>
          <Button variant="brand" className="flex-[2]" onClick={handleConfirm} disabled={isPending || loading || !preview}>
            {isPending ? m.merging : m.confirm}
          </Button>
        </SheetActions>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-brand-gray">{m.intro}</p>

        {absorbed && (
          <div>
            <span className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
              {m.absorbedLabel}
            </span>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-warm-white px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-brand-near-black">{absorbed.fullName}</div>
                <div className="truncate font-mono text-label text-brand-gray">{absorbed.email}</div>
                <div className="font-mono text-label text-brand-gray">
                  {t.admin.treasury.memberBalance(formatMoney(absorbed.balance))}
                </div>
              </div>
              {survivor && (
                <button
                  type="button"
                  onClick={swap}
                  className="min-h-11 shrink-0 rounded-lg border border-brand-border bg-white px-3 text-[12px] font-semibold text-brand-near-black"
                >
                  ⇅ {m.swap}
                </button>
              )}
            </div>
          </div>
        )}

        <MemberCombobox
          members={candidates}
          value={survivor}
          onChange={(next) => {
            setAlias(undefined);
            setSurvivor(next);
          }}
          label={m.survivorLabel}
        />

        {loading && <p className="text-label text-muted">{m.loading}</p>}

        {error && !loading && (
          <p role="alert" className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[13px] text-brand-red">
            {error}
          </p>
        )}

        {preview && !loading && (
          <>
            {preview.aliasOptions.length > 0 && (
              <fieldset>
                <legend className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
                  {m.aliasLabel}
                </legend>
                <div className="space-y-1">
                  {[...preview.aliasOptions, null].map((option) => (
                    <label
                      key={option ?? "none"}
                      className="flex min-h-11 items-center gap-2 text-[13px] text-brand-near-black"
                    >
                      <input
                        type="radio"
                        name="merge-alias"
                        checked={preview.alias === option}
                        onChange={() => setAlias(option)}
                        className="accent-primary"
                      />
                      <span className="min-w-0 break-all font-mono">{option ?? m.aliasNone}</span>
                    </label>
                  ))}
                </div>
                {preview.droppedAddresses.map((a) => (
                  <p key={a} className="mt-1 text-label text-brand-red">
                    {m.aliasDropped(a)}
                  </p>
                ))}
              </fieldset>
            )}

            <div className="rounded-lg border border-brand-border bg-brand-warm-white p-3">
              <p className="mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">{m.previewTitle}</p>
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-brand-near-black">
                {preview.movedCycleTitles.length > 0 && <li>{m.previewOrders(preview.movedCycleTitles.join(", "))}</li>}
                {preview.transfer && <li>{m.previewBalance(preview.transfer)}</li>}
                {preview.alias && <li className="break-words">{m.previewLogin(preview.alias)}</li>}
                <li>
                  {preview.deleteAbsorbed ? m.previewDelete(preview.absorbedName) : m.previewArchive(preview.absorbedName)}
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminDismissDuplicate } from "@/lib/actions/admin-members";
import type { DuplicatePair } from "@/lib/members/duplicates";
import { getRoleLabel } from "@/lib/roles";
import { t } from "@/lib/i18n";

type PairMember = { memberId: string; fullName: string; email: string; aliasEmail: string | null; role: string };

// Admin -> Members: accounts that look like the same person (rules in
// lib/members/duplicates.ts). Merge opens the usual dialog, already filled in.
export function DuplicateMembers({
  pairs,
  members,
  onMerge,
}: {
  pairs: ReadonlyArray<DuplicatePair>;
  members: ReadonlyArray<PairMember>;
  onMerge: (pair: DuplicatePair) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const d = t.admin.members.duplicates;
  const byId = new Map(members.map((m) => [m.memberId, m]));
  const rows = pairs.flatMap((p) => {
    const survivor = byId.get(p.survivorId);
    const absorbed = byId.get(p.absorbedId);
    return survivor && absorbed ? [{ pair: p, survivor, absorbed }] : [];
  });
  if (rows.length === 0) return null;

  function dismiss(pair: DuplicatePair) {
    startTransition(async () => {
      const result = await adminDismissDuplicate(pair.survivorId, pair.absorbedId);
      if (result.error) toast.error(result.error);
      else toast.success(d.dismissed);
    });
  }

  const line = (m: PairMember) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="break-words text-[13px] font-medium text-brand-near-black">{m.fullName}</span>
        <span className="text-label text-muted">{getRoleLabel(m.role)}</span>
      </div>
      <div className="break-all font-mono text-label text-brand-gray">
        {m.email}
        {m.aliasEmail ? ` · ${m.aliasEmail}` : ""}
      </div>
    </div>
  );

  return (
    <div className="mb-4 rounded-xl border border-primary-mid bg-primary-soft p-4">
      <p className="text-[13px] font-semibold text-brand-near-black">{d.title(rows.length)}</p>
      <p className="mt-1 text-label text-brand-gray">{d.intro}</p>
      <ul className="mt-3 space-y-2">
        {rows.map(({ pair, survivor, absorbed }) => (
          <li
            key={`${pair.survivorId}:${pair.absorbedId}`}
            className="space-y-2 rounded-lg border border-brand-border bg-white p-3"
          >
            {line(survivor)}
            {line(absorbed)}
            <p className="text-label text-muted">{d.reasons[pair.reason]}</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onMerge(pair)}
                className="min-h-[36px] rounded-full bg-primary px-3 text-label font-bold text-on-primary"
              >
                {d.merge}
              </button>
              <button
                onClick={() => dismiss(pair)}
                disabled={isPending}
                className="min-h-[36px] rounded-full border border-brand-border bg-white px-3 text-label font-semibold text-brand-gray disabled:opacity-40"
              >
                {d.dismiss}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

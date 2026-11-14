import type { CycleDraftSummary } from "@/lib/admin/cycle-drafts";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { formatEur } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

export function CycleDraftsCard({ drafts, cardPayment }: {
  drafts: ReadonlyArray<CycleDraftSummary>;
  cardPayment: boolean;
}) {
  if (drafts.length === 0) return null;
  const c = t.admin.cycle;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h3 className="text-[14px] font-bold text-foreground">{c.unconfirmedDrafts} ({drafts.length})</h3>
        <p className="mt-1 text-[14px] text-secondary-foreground">{cardPayment ? c.draftsUnpaid : c.draftsUnconfirmed}</p>
      </CardHeader>
      <ul className="divide-y divide-border">
        {drafts.map((draft) => (
          <li key={draft.memberId} className="min-w-0 p-4.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="break-words text-[14px] font-semibold text-foreground">{draft.name}</p>
                <Badge className="mt-1">{draft.kind === "new" ? c.draftNewOrder : c.draftChanges}</Badge>
              </div>
              <p className="text-[14px] font-semibold tabular-nums text-foreground">{c.draftEstimate(formatEur(draft.estimatedTotal))}</p>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              <time dateTime={draft.updatedAt.toISOString()}>{c.draftModified(formatDateTime(draft.updatedAt))}</time>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

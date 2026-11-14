import type { DraftLine } from "@/lib/db/schema";
import { resumeDraft } from "@/lib/order-draft";

type CycleDraft = {
  memberId: string;
  name: string;
  lines: ReadonlyArray<DraftLine> | null;
  updatedAt: Date;
};

export type CycleDraftSummary = {
  memberId: string;
  name: string;
  kind: "new" | "changes";
  estimatedTotal: number;
  lineCount: number;
  updatedAt: Date;
};

// Match what /ordine can resume. Estimates cover the current products only,
// without shipping, fees or deposits, and never change a confirmed order.
export function summarizeCycleDrafts(
  drafts: ReadonlyArray<CycleDraft>,
  products: ReadonlyArray<{ productId: string; unitPrice: number | string }>,
  confirmedLinesByMember: ReadonlyMap<string, ReadonlyArray<DraftLine>>,
): CycleDraftSummary[] {
  const prices = new Map(products.map((product) => [product.productId, Number(product.unitPrice)]));
  const availableProductIds = new Set(prices.keys());
  const summaries: CycleDraftSummary[] = [];

  for (const draft of drafts) {
    const confirmed = confirmedLinesByMember.get(draft.memberId) ?? [];
    const resumed = resumeDraft(draft.lines, confirmed, availableProductIds);
    if (!resumed) continue;

    summaries.push({
      memberId: draft.memberId,
      name: draft.name,
      kind: confirmed.length > 0 ? "changes" : "new",
      estimatedTotal: resumed.lines.reduce((total, line) => total + prices.get(line.productId)! * line.quantity, 0),
      lineCount: resumed.lines.length,
      updatedAt: draft.updatedAt,
    });
  }

  return summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

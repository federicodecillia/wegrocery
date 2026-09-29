// Pure rules of the order draft kept on the server (order_drafts): how a
// draft is cleaned before it is stored, compared with the confirmed order and
// picked up again on /ordine. lib/actions/order.ts and app/ordine do the I/O.

import type { DraftLine } from "@/lib/db/schema";

export const DRAFT_MAX_LINES = 500;
const MAX_QUANTITY = 9999;
const MAX_PRODUCT_ID_LENGTH = 64;

// The lines to store: positive integer quantities, one line per product (the
// last one wins), sorted by product so equal drafts are stored alike. null
// when the input is not a list of { productId, quantity } within bounds.
export function normalizeDraftLines(input: unknown): DraftLine[] | null {
  if (!Array.isArray(input) || input.length > DRAFT_MAX_LINES) return null;
  const byProduct = new Map<string, number>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) return null;
    const { productId, quantity } = item as { productId?: unknown; quantity?: unknown };
    if (typeof productId !== "string" || productId === "" || productId.length > MAX_PRODUCT_ID_LENGTH) return null;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
      return null;
    }
    byProduct.set(productId, quantity);
  }
  return [...byProduct]
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
}

// A canonical string for a set of lines: equal for the same products and
// quantities in any order; zero lines do not count.
export function orderLinesKey(lines: ReadonlyArray<{ productId: string; quantity: number }>): string {
  return lines
    .filter((l) => l.quantity > 0)
    .map((l) => `${l.productId}:${l.quantity}`)
    .sort()
    .join("|");
}

export function sameOrderLines(
  a: ReadonlyArray<{ productId: string; quantity: number }>,
  b: ReadonlyArray<{ productId: string; quantity: number }>,
): boolean {
  return orderLinesKey(a) === orderLinesKey(b);
}

export type ResumedDraft = { lines: DraftLine[]; dropped: number };

// What /ordine picks up from a stored draft: only the products still in the
// cycle, and how many lines fell out (the member gets a notice). null when
// there is nothing to pick up, i.e. no draft or one that shows the same as the
// confirmed order (an autosave that raced the confirm lands here).
export function resumeDraft(
  draft: ReadonlyArray<DraftLine> | null,
  confirmed: ReadonlyArray<{ productId: string; quantity: number }>,
  availableProductIds: ReadonlySet<string>,
): ResumedDraft | null {
  if (!draft) return null;
  const positive = draft.filter((l) => l.quantity > 0);
  const lines = positive.filter((l) => availableProductIds.has(l.productId));
  const shownConfirmed = confirmed.filter((l) => availableProductIds.has(l.productId));
  if (sameOrderLines(lines, shownConfirmed)) return null;
  return { lines, dropped: positive.length - lines.length };
}

// What the order form's autosave must do so the server holds what the form
// shows: nothing, save the draft, or drop it (the form is back to the
// confirmed order). `serverKey` is the orderLinesKey of what the server holds.
export type DraftSync = "none" | "save" | "discard";

export function draftSyncAction(draftKey: string, savedKey: string, serverKey: string): DraftSync {
  if (draftKey === serverKey) return "none";
  return draftKey === savedKey ? "discard" : "save";
}

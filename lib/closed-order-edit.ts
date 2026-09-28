// Pure planning for adminEditClosedOrder, extracted so it can be unit tested
// ("use server" modules can only export async functions).
//
// The admin submits the member's final desired order; this works out which
// existing rows to keep, update or delete and which to insert, and the money
// delta against what the member is currently charged. Two rules protect
// post-delivery corrections:
// - the old total is the EFFECTIVE one, coalesce(actual_line_total,
//   line_total), because a weighing already posted its own correction;
// - a line whose quantity does not change is left untouched, so its actuals
//   survive. A line whose ordered quantity changes is re-priced at its own
//   unit_price_snapshot and its actuals are reset: the weighing referred to
//   the old quantity, and the delta is computed from the effective total, so
//   nothing is refunded twice when the line is weighed again.

export type ExistingOrderLine = {
  orderLineId: string;
  productId: string;
  quantity: number;
  unitPriceSnapshot: string;
  lineTotal: string;
  actualQuantity: string | null;
  actualLineTotal: string | null;
};

export type ClosedOrderEditPlan = {
  updates: Array<{ orderLineId: string; quantity: number; lineTotal: string }>;
  inserts: Array<{ productId: string; quantity: number; unitPrice: string; lineTotal: string }>;
  deletes: string[];
  oldTotal: number;
  newTotal: number;
  // newTotal - oldTotal: positive = the member owes more.
  delta: number;
};

function toCents(value: string): number {
  return Math.round(parseFloat(value) * 100);
}

function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function effectiveCents(line: ExistingOrderLine): number {
  return toCents(line.actualLineTotal ?? line.lineTotal);
}

export function planClosedOrderEdit(
  existing: ReadonlyArray<ExistingOrderLine>,
  requested: ReadonlyArray<{ productId: string; quantity: number }>,
  currentPrices: ReadonlyMap<string, string>,
): ClosedOrderEditPlan {
  // Normalise the request: integer quantities > 0, one entry per product.
  const wanted = new Map<string, number>();
  for (const r of requested) {
    const qty = Math.floor(r.quantity);
    if (!r.productId || !(qty > 0)) continue;
    wanted.set(r.productId, (wanted.get(r.productId) ?? 0) + qty);
  }

  const existingByProduct = new Map(existing.map((l) => [l.productId, l]));
  const plan: ClosedOrderEditPlan = {
    updates: [],
    inserts: [],
    deletes: [],
    oldTotal: 0,
    newTotal: 0,
    delta: 0,
  };

  let oldCents = 0;
  let newCents = 0;

  for (const line of existing) {
    oldCents += effectiveCents(line);
    const qty = wanted.get(line.productId);
    if (qty === undefined) {
      plan.deletes.push(line.orderLineId);
    } else if (qty === line.quantity) {
      newCents += effectiveCents(line);
    } else {
      const lineCents = Math.round(toCents(line.unitPriceSnapshot) * qty);
      plan.updates.push({
        orderLineId: line.orderLineId,
        quantity: qty,
        lineTotal: centsToString(lineCents),
      });
      newCents += lineCents;
    }
  }

  for (const [productId, qty] of wanted) {
    if (existingByProduct.has(productId)) continue;
    const price = currentPrices.get(productId);
    if (price === undefined) throw new Error(`No price for product ${productId}`);
    const lineCents = Math.round(toCents(price) * qty);
    plan.inserts.push({ productId, quantity: qty, unitPrice: price, lineTotal: centsToString(lineCents) });
    newCents += lineCents;
  }

  plan.oldTotal = oldCents / 100;
  plan.newTotal = newCents / 100;
  plan.delta = (newCents - oldCents) / 100;
  return plan;
}

// JSON object orderLineId → [quantity, line_total, actual_line_total], with
// the money exactly as the DB returned it. The edit batch compares it (as
// jsonb) with the same object rebuilt inside the transaction: if the member's
// lines changed after the plan was computed (a concurrent edit or weighing,
// a double submit), the delta would be stale and the batch aborts instead of
// posting a second correction.
export function orderLinesSnapshot(lines: ReadonlyArray<ExistingOrderLine>): string {
  return JSON.stringify(
    Object.fromEntries(
      lines.map((l) => [l.orderLineId, [l.quantity, l.lineTotal, l.actualLineTotal]]),
    ),
  );
}

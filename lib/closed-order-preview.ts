// What the admin's correction forms compute in the browser before calling
// the server (Recap ordini → a line's delivered weight, ✎ on a member's
// closed order). Pulled out of the components as they were, so the cycle
// workspace can move the forms without touching a number: the server still
// receives exactly these strings.

/** "1,2" → 1.2; the forms accept a decimal comma (the first one). */
function parseInput(value: string): number {
  return parseFloat(value.replace(",", "."));
}

/**
 * The delivered line's total as the form fills it while the quantity is
 * typed: quantity × unit price, rounded to the cent. Null when the quantity
 * is not a number ≥ 0 (the total is then left as it was).
 */
export function deliveredTotalFromQuantity(qtyInput: string, unitPrice: string): string | null {
  const n = parseInput(qtyInput);
  if (!Number.isFinite(n) || n < 0) return null;
  return (Math.round(n * parseFloat(unitPrice) * 100) / 100).toFixed(2);
}

/**
 * The actuals sent to adminUpdateOrderLineActuals: both null when the line
 * went back to what was ordered (the server then reverses any previous
 * correction), else the quantity to 3 decimals and the total to 2.
 */
export function deliveredActuals(
  qtyInput: string,
  totalInput: string,
  ordered: { quantity: number; lineTotal: string },
): { actualQuantity: string | null; actualLineTotal: string | null } {
  const qty = parseInput(qtyInput);
  const total = parseInput(totalInput);
  const sameAsOrdered =
    Number.isFinite(qty) && qty === ordered.quantity && Math.abs(total - parseFloat(ordered.lineTotal)) < 0.005;
  if (sameAsOrdered) return { actualQuantity: null, actualLineTotal: null };
  return {
    actualQuantity: Number.isFinite(qty) ? qty.toFixed(3) : null,
    actualLineTotal: Number.isFinite(total) ? total.toFixed(2) : null,
  };
}

/**
 * The preview of an edited closed order: the new total at the cycle's
 * prices, the old one from the lines on file, and the difference that the
 * correction will post (the server computes it again).
 */
export function editedOrderPreview(
  products: ReadonlyArray<{ productId: string; unitPrice: string }>,
  quantities: Readonly<Record<string, number>>,
  memberLines: ReadonlyArray<{ lineTotal: string }>,
): { newTotal: number; oldTotal: number; delta: number } {
  const newTotal = products.reduce((sum, p) => {
    const qty = quantities[p.productId] ?? 0;
    return qty > 0 ? sum + parseFloat(p.unitPrice) * qty : sum;
  }, 0);
  const oldTotal = memberLines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
  return { newTotal, oldTotal, delta: newTotal - oldTotal };
}

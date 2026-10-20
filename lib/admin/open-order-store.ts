import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { orderLinesSnapshot, type ExistingOrderLine } from "@/lib/closed-order-edit";

// The database side of adminSaveOpenOrder: an admin replaces a member's order
// on a cycle that is still open, also after its deadline (a late order phoned
// in, a member who asked for a change). Nothing touches the ledger: the close
// charges this order like every other one, so there is no correction to post.

type Db = ReturnType<typeof getDb>;

export type OpenOrderLine = { productId: string; quantity: number; unitPrice: string };

export async function readMemberOrderLines(db: Db, memberId: string, cycleId: string): Promise<ExistingOrderLine[]> {
  const { rows } = await db.execute<{
    order_line_id: string;
    product_id: string;
    quantity: number;
    unit_price_snapshot: string;
    line_total: string;
    actual_quantity: string | null;
    actual_line_total: string | null;
  }>(sql`
    SELECT order_line_id, product_id, quantity, unit_price_snapshot::text, line_total::text,
           actual_quantity::text, actual_line_total::text
    FROM orders WHERE cycle_id = ${cycleId} AND member_id = ${memberId}
  `);
  return rows.map((r) => ({
    orderLineId: r.order_line_id,
    productId: r.product_id,
    quantity: r.quantity,
    unitPriceSnapshot: r.unit_price_snapshot,
    lineTotal: r.line_total,
    actualQuantity: r.actual_quantity,
    actualLineTotal: r.actual_line_total,
  }));
}

// Replaces the member's lines with `lines` in ONE transaction, like saveOrder:
// the cycle is row-locked and must still be open (the deadline does not
// matter here), and the member's lines must still be the ones the admin saw,
// so a close, or a save by the member, in the meantime writes nothing. The
// member's unconfirmed draft goes too: the admin's order is the one that counts.
// "changed" = the guard fired and nothing was written.
export async function replaceOpenOrder(
  db: Db,
  input: { memberId: string; cycleId: string; lines: OpenOrderLine[]; expected: ExistingOrderLine[] },
): Promise<"saved" | "changed"> {
  const { memberId, cycleId } = input;
  const lock = db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`);
  const lockLines = db.execute(
    sql`SELECT 1 FROM orders WHERE cycle_id = ${cycleId} AND member_id = ${memberId} FOR UPDATE`,
  );
  const guard = db.execute(sql`
    SELECT 1 / (CASE WHEN
      coalesce((SELECT status = 'open' FROM order_cycles WHERE cycle_id = ${cycleId}), false)
      AND (SELECT coalesce(jsonb_object_agg(order_line_id,
             jsonb_build_array(quantity, line_total::text, actual_line_total::text)), '{}'::jsonb)
           FROM orders WHERE cycle_id = ${cycleId} AND member_id = ${memberId})
          = ${orderLinesSnapshot(input.expected)}::jsonb
    THEN 1 ELSE 0 END) AS open_order_guard
  `);
  const deleteOrder = db.execute(sql`DELETE FROM orders WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  const lines = input.lines.filter((l) => l.quantity > 0);
  const insertOrder = db.execute(sql`
    INSERT INTO orders
      (order_line_id, cycle_id, member_id, product_id, quantity, unit_price_snapshot, line_total, updated_at)
    SELECT gen_random_uuid()::text, ${cycleId}, ${memberId}, l."productId", l.quantity,
           l."unitPrice"::numeric, round(l."unitPrice"::numeric * l.quantity, 2), now()
    FROM jsonb_to_recordset(${JSON.stringify(lines)}::jsonb)
      AS l("productId" text, quantity integer, "unitPrice" text)
  `);
  const deleteDraft = db.execute(sql`DELETE FROM order_drafts WHERE member_id = ${memberId} AND cycle_id = ${cycleId}`);
  try {
    await db.batch([lock, lockLines, guard, deleteOrder, insertOrder, deleteDraft]);
    return "saved";
  } catch (e) {
    // 22012 = division_by_zero, i.e. the guard fired.
    if (e instanceof Error && /22012|division by zero/i.test(e.message)) return "changed";
    throw e;
  }
}

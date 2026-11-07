// Limited quantities per cycle (drizzle/0054_stock_limits.sql): a cycle's
// product may have units for sale (max_quantity) and a cap per member
// (max_per_member). Nothing is counted down: what is left is always computed
// from the orders and the open card Checkouts, under the cycle's row lock
// that every order write already takes, so it cannot drift from the orders.
//
// Members only ever see "Esaurito" (sold out), never a number left.

import { sql, type SQL } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { isSoldOut, type ProductStock, type StockLine } from "./stock-rules";

export * from "./stock-rules";

type Db = ReturnType<typeof getDb>;

/**
 * How long an open card Checkout keeps its quantities: a little more than the
 * Checkout's own life (31 minutes, lib/actions/order-payment.ts), so a member
 * paying in time never finds the product gone.
 */
export const RESERVATION_MINUTES = 32;

// What a member holds of a product: the larger of their confirmed quantity
// and what an open card Checkout of theirs reserves. The larger, not the sum:
// a Checkout replaces the order when paid.
function heldSql(cycleId: string): SQL {
  return sql`(
    SELECT m.member_id, m.product_id, max(m.quantity)::int AS held FROM (
      SELECT o.member_id, o.product_id, sum(o.quantity)::int AS quantity
      FROM orders o WHERE o.cycle_id = ${cycleId}
      GROUP BY o.member_id, o.product_id
      UNION ALL
      SELECT p.member_id, l."productId", l.quantity
      FROM payments p
      CROSS JOIN LATERAL jsonb_to_recordset(p.order_snapshot -> 'lines') AS l("productId" text, quantity integer)
      WHERE p.cycle_id = ${cycleId} AND p.kind = 'order' AND p.status = 'pending'
        AND p.created_at > now() - make_interval(mins => ${RESERVATION_MINUTES})
    ) m
    GROUP BY m.member_id, m.product_id
  )`;
}

const limitsOn = sql`coalesce((SELECT stock_limits_enabled FROM app_settings WHERE id = 1), false)`;

/**
 * True when `lines` fit: for every line that grows past the member's confirmed
 * quantity, the cap per member and the units left after the other members.
 * Run it under the cycle's row lock and BEFORE the member's lines are
 * replaced, in the same batch: `SELECT 1 / (CASE WHEN <this> THEN 1 ELSE 0 END)`.
 * With the setting off it is always true.
 */
export function stockFitsSql(input: { cycleId: string; memberId: SQL | string; lines: SQL | readonly StockLine[] }): SQL {
  const { cycleId } = input;
  const memberId = typeof input.memberId === "string" ? sql`${input.memberId}` : input.memberId;
  const lines = Array.isArray(input.lines)
    ? sql`jsonb_to_recordset(${JSON.stringify(input.lines)}::jsonb) AS l("productId" text, quantity integer)`
    : (input.lines as SQL);
  return sql`(NOT ${limitsOn} OR NOT EXISTS (
    SELECT 1 FROM ${lines}
    JOIN products pr ON pr.product_id = l."productId" AND pr.cycle_id = ${cycleId}
    WHERE (pr.max_quantity IS NOT NULL OR pr.max_per_member IS NOT NULL)
      AND l.quantity > coalesce((
        SELECT sum(o.quantity) FROM orders o
        WHERE o.cycle_id = ${cycleId} AND o.member_id = ${memberId} AND o.product_id = pr.product_id
      ), 0)
      AND (
        (pr.max_per_member IS NOT NULL AND l.quantity > pr.max_per_member)
        OR (pr.max_quantity IS NOT NULL AND l.quantity + coalesce((
          SELECT sum(h.held) FROM ${heldSql(cycleId)} h
          WHERE h.product_id = pr.product_id AND h.member_id <> ${memberId}
        ), 0) > pr.max_quantity)
      )
  ))`;
}

/** The limited products of a cycle for one member; empty with the setting off. */
export async function readCycleStock(db: Db, cycleId: string, memberId: string | null): Promise<Map<string, ProductStock>> {
  const { rows } = await db.execute<{
    product_id: string;
    max_quantity: number | null;
    max_per_member: number | null;
    others: number;
    mine: number;
  }>(sql`
    SELECT pr.product_id, pr.max_quantity, pr.max_per_member,
      coalesce((SELECT sum(h.held) FROM ${heldSql(cycleId)} h
                WHERE h.product_id = pr.product_id AND h.member_id IS DISTINCT FROM ${memberId}), 0)::int AS others,
      coalesce((SELECT sum(o.quantity) FROM orders o
                WHERE o.cycle_id = ${cycleId} AND o.member_id = ${memberId} AND o.product_id = pr.product_id), 0)::int AS mine
    FROM products pr
    WHERE pr.cycle_id = ${cycleId} AND ${limitsOn}
      AND (pr.max_quantity IS NOT NULL OR pr.max_per_member IS NOT NULL)
  `);
  return new Map(
    rows.map((r) => [
      r.product_id,
      {
        productId: r.product_id,
        maxQuantity: r.max_quantity,
        maxPerMember: r.max_per_member,
        usedByOthers: Number(r.others),
        mine: Number(r.mine),
      },
    ]),
  );
}

/**
 * The sold out products of a cycle, as ids only: what the public page may
 * show a visitor ("Esaurito"), never a count. Empty with the setting off.
 */
export async function readSoldOutProductIds(db: Db, cycleId: string): Promise<Set<string>> {
  const stock = await readCycleStock(db, cycleId, null);
  return new Set([...stock.values()].filter(isSoldOut).map((s) => s.productId));
}

/** Units of each product ordered or reserved by anyone (admin: "venduti / disponibili"). */
export async function readCycleSold(db: Db, cycleId: string): Promise<Map<string, number>> {
  const { rows } = await db.execute<{ product_id: string; sold: number }>(sql`
    SELECT h.product_id, sum(h.held)::int AS sold FROM ${heldSql(cycleId)} h GROUP BY h.product_id
  `);
  return new Map(rows.map((r) => [r.product_id, Number(r.sold)]));
}

/**
 * Sets the two limits of a cycle product under the cycle's lock. Units for
 * sale never go below what is already ordered or reserved: then nothing is
 * written and the sold quantity comes back.
 */
export async function setProductLimits(
  db: Db,
  input: { productId: string; maxQuantity: number | null; maxPerMember: number | null },
): Promise<{ ok: true } | { ok: false; sold: number }> {
  const [row] = (
    await db.execute<{ cycle_id: string }>(sql`SELECT cycle_id FROM products WHERE product_id = ${input.productId}`)
  ).rows;
  if (!row) return { ok: true };
  const cycleId = row.cycle_id;
  const sold = sql`coalesce((SELECT sum(h.held) FROM ${heldSql(cycleId)} h WHERE h.product_id = ${input.productId}), 0)`;
  try {
    await db.batch([
      db.execute(sql`SELECT 1 FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`),
      db.execute(sql`SELECT 1 / (CASE WHEN ${input.maxQuantity}::int IS NULL OR ${input.maxQuantity}::int >= ${sold}
        THEN 1 ELSE 0 END) AS limit_guard`),
      db.execute(sql`UPDATE products SET max_quantity = ${input.maxQuantity}, max_per_member = ${input.maxPerMember}
        WHERE product_id = ${input.productId}`),
    ]);
    return { ok: true };
  } catch (e) {
    if (!(e instanceof Error && /22012|division by zero/i.test(e.message))) throw e;
    return { ok: false, sold: (await readCycleSold(db, cycleId)).get(input.productId) ?? 0 };
  }
}

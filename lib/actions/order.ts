"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { getDb } from "@/lib/db/client";
import { auditLog, orders } from "@/lib/db/schema";
import {
  getCycleProducts,
  getLastMemberOrderForPrefill,
  getMemberBalance,
  getMemberByEmail,
  getMemberById,
  getMemberPendingOrderTotals,
  getOpenCycles,
} from "@/lib/db/queries";
import { recordMembershipCheck } from "@/lib/membership/members";
import {
  evaluateCreditLimit,
  orderMembershipOutcome,
  raisesOrderTotal,
  shouldRecheckMembershipOnOrder,
} from "@/lib/membership/policy";
import { checkMembershipAny, isMembershipCheckEnabled } from "@/lib/membership/wallyfor";
import { canAccessCycle } from "@/lib/roles";
import { actionErrorMessage } from "@/lib/action-error";

export type SaveOrderLine = { productId: string; quantity: number };

// Expected refusals (closed cycle, lapsed card, credit limit...) come back as
// a value, with a stable `code` the client can branch on: in production
// Next.js replaces the message of an error thrown by a Server Action with a
// generic digest, so a thrown message never reaches the member.
export type SaveOrderErrorCode =
  | "member_not_found"
  | "account_inactive"
  | "invalid_quantity"
  | "cycle_not_open"
  | "access_denied"
  | "product_not_found"
  | "membership_inactive"
  | "credit_limit_exceeded"
  | "unexpected";

export type SaveOrderResult =
  | { success: true; balanceWarning: string | null }
  | { success: false; error: string; code: SaveOrderErrorCode };

export async function saveOrder(
  cycleId: string,
  lines: SaveOrderLine[],
): Promise<SaveOrderResult> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) redirect("/login");

    // The member the session resolved (auth.ts jwt callback), not a second
    // lookup by email.
    const memberId = (session.user as { memberId?: string | null }).memberId;
    const member = memberId ? await getMemberById(memberId) : null;
    if (!member) return { success: false, error: t.errors.memberNotFound, code: "member_not_found" };
    if (!member.active) return { success: false, error: t.errors.accountInactive, code: "account_inactive" };

    // The schema stores quantities as integers; reject anything the DB would
    // choke on (fractions, negatives, absurd values) before touching the order.
    for (const l of lines) {
      if (!Number.isInteger(l.quantity) || l.quantity < 0 || l.quantity > 9999) {
        return { success: false, error: t.errors.invalidQuantity, code: "invalid_quantity" };
      }
    }

    const cycles = await getOpenCycles();
    const cycle = cycles.find((c) => c.cycleId === cycleId);
    if (!cycle) {
      return { success: false, error: t.errors.cycleNotOpen, code: "cycle_not_open" };
    }
    if (!canAccessCycle(cycle.accessLevel, member.role)) {
      return { success: false, error: t.errors.accessDenied, code: "access_denied" };
    }

    const db = getDb();
    const now = new Date();

    const cycleProducts = await getCycleProducts(cycleId);
    const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));

    const newLines = lines.filter((l) => l.quantity > 0);
    const unknownLine = newLines.find((l) => !productMap.has(l.productId));
    if (unknownLine) {
      return { success: false, error: t.errors.productNotFound(unknownLine.productId), code: "product_not_found" };
    }
    const total = newLines.reduce(
      (sum, l) => sum + parseFloat(productMap.get(l.productId)!.unitPrice) * l.quantity,
      0,
    );

    // Uncharged order totals: needed by the credit limit and to tell whether
    // this save raises the cycle's order (trimming/cancelling is never blocked).
    const checkEnabled = isMembershipCheckEnabled() && member.role !== "admin";
    const pending =
      brand.minBalance !== null || checkEnabled
        ? await getMemberPendingOrderTotals(member.memberId, cycleId)
        : null;
    const raisesOrder = pending ? raisesOrderTotal(pending.thisCycle, total) : true;

    // Membership card: rechecked at most every 24h (a lapsed result is always
    // rechecked). An unreachable API lets the order through: they were members
    // at sign-in.
    if (shouldRecheckMembershipOnOrder(member, checkEnabled, now, raisesOrder)) {
      const result = await checkMembershipAny([member.email, member.aliasEmail]);
      const outcome = orderMembershipOutcome(result);
      if (result.status === "error") {
        console.error(`[saveOrder] membership check unavailable: ${result.message}`);
      }
      if (outcome.record) {
        try {
          await recordMembershipCheck(member.memberId, outcome.record, now);
        } catch (err) {
          console.error("[saveOrder] could not record membership check", err);
        }
      }
      if (!outcome.allow) {
        return {
          success: false,
          error: t.errors.membershipInactive(brand.membershipUrl),
          code: "membership_inactive",
        };
      }
    }

    // Credit limit (brand.minBalance). Checked before the write, so two saves
    // racing on different cycles can overshoot it; the in-transaction SQL guard
    // is Phase 1 work.
    if (brand.minBalance !== null && pending) {
      const credit = evaluateCreditLimit({
        balance: await getMemberBalance(member.memberId),
        openOrdersOtherCycles: pending.otherOpenCycles,
        previousOrderTotal: pending.thisCycle,
        newOrderTotal: total,
        minBalance: brand.minBalance,
      });
      if (!credit.ok) {
        return {
          success: false,
          error: t.errors.creditLimitExceeded(formatMoney(credit.available)),
          code: "credit_limit_exceeded",
        };
      }
    }

    // The Neon HTTP driver has no session to hold BEGIN...COMMIT across separate
    // round-trips, so delete + insert as two awaits could be interrupted between
    // the two, silently leaving the member's order empty. db.batch() ships both
    // statements in one HTTP request and Neon runs them in a single transaction,
    // so they succeed or fail together.
    //
    // The guard statement closes the race with performCycleClose (issue #84):
    // it row-locks the cycle inside this transaction, so a concurrent close CAS
    // waits until our write commits (and then charges these fresh rows), and if
    // the close committed first the CASE yields 0 and the division error rolls
    // back the whole batch — no order row can land on a closed cycle uncharged.
    const guardCycleStillOpen = db.execute(
      sql`SELECT 1 / (CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_guard
          FROM order_cycles WHERE cycle_id = ${cycleId} FOR UPDATE`,
    );
    const deleteExisting = db
      .delete(orders)
      .where(and(eq(orders.memberId, member.memberId), eq(orders.cycleId, cycleId)));

    try {
      if (newLines.length > 0) {
        const insertNew = db.insert(orders).values(
          newLines.map((l) => {
            const product = productMap.get(l.productId)!; // every new line was checked above
            const lineTotal = (parseFloat(product.unitPrice) * l.quantity).toFixed(2);
            return {
              orderLineId: crypto.randomUUID(),
              cycleId,
              memberId: member.memberId,
              productId: l.productId,
              quantity: l.quantity,
              unitPriceSnapshot: product.unitPrice,
              lineTotal,
              updatedAt: now,
            };
          }),
        );
        await db.batch([guardCycleStillOpen, deleteExisting, insertNew]);
      } else {
        await db.batch([guardCycleStillOpen, deleteExisting]);
      }
    } catch (err) {
      // 22012 = division_by_zero, i.e. the guard found the cycle closed.
      if (err instanceof Error && /22012|division by zero/i.test(err.message)) {
        return { success: false, error: t.errors.cycleNotOpen, code: "cycle_not_open" };
      }
      throw err;
    }

    const balance = await getMemberBalance(member.memberId);
    const afterBalance = balance - total;

    await db.insert(auditLog).values({
      auditId: crypto.randomUUID(),
      userEmail: email,
      action: "saveMyOrder",
      entityType: "order",
      entityId: cycleId,
      payloadJson: JSON.stringify({ lineCount: newLines.length, total: total.toFixed(2) }),
      createdAt: now,
    });

    return {
      success: true,
      balanceWarning:
        afterBalance < 0 ? t.order.balanceWarning(formatMoney(Math.abs(afterBalance))) : null,
    };
  } catch (e) {
    // Never the raw message: a driver error can quote SQL.
    return {
      success: false,
      error: actionErrorMessage(e, t.errors.genericError, "saveOrder"),
      code: "unexpected",
    };
  }
}

// Loads the member's most recent past order and maps its products to the
// current cycle's products (matched by name/variant/format/unit). Used by
// the order form's "Riproponi ultimo ordine" button.
export async function loadLastOrderForPrefill(
  cycleId: string,
): Promise<{ cycleTitle: string; quantities: Record<string, number>; matched: number } | { error: string }> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) redirect("/login");

    const member = await getMemberByEmail(email);
    if (!member) return { error: t.errors.memberNotFound };
    if (!member.active) return { error: t.errors.accountInactive };

    const result = await getLastMemberOrderForPrefill(member.memberId, cycleId);
    return { ...result, matched: Object.keys(result.quantities).length };
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "loadLastOrderForPrefill") };
  }
}

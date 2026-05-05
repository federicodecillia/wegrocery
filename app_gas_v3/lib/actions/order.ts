"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { auditLog, orders } from "@/lib/db/schema";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberByEmail,
  getOpenCycles,
} from "@/lib/db/queries";
import { canAccessCycle } from "@/lib/utils";

export type SaveOrderLine = { productId: string; quantity: number };

export async function saveOrder(
  cycleId: string,
  lines: SaveOrderLine[],
): Promise<{ success: boolean; balanceWarning: string | null }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const member = await getMemberByEmail(email);
  if (!member) throw new Error("Socio non trovato");

  const cycles = await getOpenCycles();
  const cycle = cycles.find((c) => c.cycleId === cycleId);
  if (!cycle) {
    throw new Error("Il ciclo non è più aperto");
  }
  if (!canAccessCycle(cycle.accessLevel, member.role)) {
    throw new Error("Non hai accesso a questo ciclo");
  }

  const cycleProducts = await getCycleProducts(cycleId);
  const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));

  const db = getDb();
  const now = new Date();
  const newLines = lines.filter((l) => l.quantity > 0);

  await db
    .delete(orders)
    .where(and(eq(orders.memberId, member.memberId), eq(orders.cycleId, cycleId)));

  if (newLines.length > 0) {
    await db.insert(orders).values(
      newLines.map((l) => {
        const product = productMap.get(l.productId);
        if (!product) throw new Error(`Prodotto non trovato: ${l.productId}`);
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
  }

  const total = newLines.reduce((sum, l) => {
    const p = productMap.get(l.productId)!;
    return sum + parseFloat(p.unitPrice) * l.quantity;
  }, 0);

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
      afterBalance < 0
        ? `Attenzione: dopo l'ordine il tuo saldo sarà €${Math.abs(afterBalance).toFixed(2).replace(".", ",")} negativo.`
        : null,
  };
}

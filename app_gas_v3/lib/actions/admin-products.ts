"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { supplierProducts, auditLog } from "@/lib/db/schema";
import { getProductEmoji } from "@/lib/utils";

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!email || role !== "admin") throw new Error("Accesso non autorizzato");
  return { email };
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function adminImportProductsCsv(supplierId: string, csvText: string) {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const now = new Date();

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length <= 1) return { error: "Il file CSV è vuoto o contiene solo l'intestazione." };

    // Skip header
    const rows = lines.slice(1);
    const results = [];

    for (const row of rows) {
      // Robust parsing: try semicolon first (common in Italian Excel), then comma
      let columns = row.split(";").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      if (columns.length < 5) {
        columns = row.split(",").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      }
      
      if (columns.length < 5) continue; // Minimum required: Nome, Varieta, Formato, Unita, Prezzo

      const name = columns[0];
      const variant = columns[1] || null;
      const format = columns[2] || null;
      const unit = columns[3] || null;
      const unitPriceStr = columns[4].replace(",", ".");
      const category = columns[5] || null;
      const emoji = columns[6] || getProductEmoji(name);
      const notes = columns[7] || null;

      const unitPrice = parseFloat(unitPriceStr);
      if (isNaN(unitPrice)) continue;

      results.push({
        catalogProductId: genId("cp"),
        supplierId,
        name,
        variant,
        format,
        unit,
        unitPrice: unitPrice.toString(),
        category,
        emoji,
        notes,
        active: true,
        createdAt: now,
      });
    }

    if (results.length > 0) {
      await db.insert(supplierProducts).values(results);
      
      await db.insert(auditLog).values({
        auditId: crypto.randomUUID(),
        userEmail: admin.email,
        action: "import_products_csv",
        entityType: "supplier",
        entityId: supplierId,
        payloadJson: JSON.stringify({ count: results.length }),
        createdAt: now,
      });

      revalidatePath("/admin");
      return { success: true, count: results.length };
    }

    return { error: "Nessun prodotto valido trovato nel CSV." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore durante l'importazione" };
  }
}

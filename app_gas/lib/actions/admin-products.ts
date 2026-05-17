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

    // New column layout (v1.4.3+):
    //   Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note
    //
    // The "Unità" column was removed because it duplicated the format string
    // and confused admins. Old templates that still include "Unità" are
    // handled below by sniffing the header row.

    const header = lines[0].toLowerCase();
    const usesLegacyLayout = header.includes("unità") || header.includes("unita");

    for (const row of rows) {
      // Robust parsing: try semicolon first (common in Italian Excel), then comma
      let columns = row.split(";").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      if (columns.length < 4) {
        columns = row.split(",").map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      }

      if (columns.length < 4) continue; // need at least Nome, Varietà, Formato, Prezzo

      const name = columns[0];
      const variant = columns[1] || null;
      const format = columns[2] || null;

      let unit: string | null = null;
      let unitPriceStr: string;
      let pricePerKgStr: string | null = null;
      let category: string | null = null;
      let emoji: string;
      let notes: string | null = null;

      if (usesLegacyLayout) {
        // Legacy: Nome; Varietà; Formato; Unità; Prezzo; Categoria; Icona; Note
        unit = columns[3] || null;
        unitPriceStr = (columns[4] || "").replace(",", ".");
        category = columns[5] || null;
        emoji = columns[6] || getProductEmoji(name);
        notes = columns[7] || null;
      } else {
        // New: Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note
        unitPriceStr = (columns[3] || "").replace(",", ".");
        const ppk = (columns[4] || "").replace(",", ".");
        pricePerKgStr = ppk && !isNaN(parseFloat(ppk)) ? parseFloat(ppk).toFixed(2) : null;
        category = columns[5] || null;
        emoji = columns[6] || getProductEmoji(name);
        notes = columns[7] || null;
      }

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
        pricePerKg: pricePerKgStr,
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

// Writes an import plan (lib/members/import.ts): the importable rows in one
// statement, then one audit row with counts only, never addresses.

import { auditLog, members } from "@/lib/db/schema";
import type { getDb } from "@/lib/db/client";
import { isImportable, type ImportPlan } from "./import";

type Db = ReturnType<typeof getDb>;

/**
 * Creates the "new" and "possible_duplicate" rows. A member created
 * meanwhile with the same address is skipped by the unique indexes (ON
 * CONFLICT DO NOTHING), so the same file imported twice creates nobody the
 * second time. No email is sent. Returns the ids created.
 */
export async function insertImportedMembers(
  db: Db,
  plan: Extract<ImportPlan, { ok: true }>,
  adminEmail: string,
): Promise<string[]> {
  const rows = plan.rows.filter(isImportable);
  if (rows.length === 0) return [];
  const now = new Date();
  const inserted = await db
    .insert(members)
    .values(
      rows.map((row) => ({
        memberId: `mem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        fullName: row.fullName,
        email: row.email,
        aliasEmail: row.aliasEmail,
        role: row.role,
        active: true,
        paysOffline: row.paysOffline,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ memberId: members.memberId });
  await db.insert(auditLog).values({
    auditId: crypto.randomUUID(),
    userEmail: adminEmail,
    action: "import_members",
    entityType: "member",
    entityId: "import",
    payloadJson: JSON.stringify({ planned: rows.length, created: inserted.length, counts: plan.counts }),
    createdAt: now,
  });
  return inserted.map((m) => m.memberId);
}

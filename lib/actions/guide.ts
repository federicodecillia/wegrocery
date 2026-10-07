"use server";

import { lt, sql } from "drizzle-orm";
import { actionErrorMessage } from "@/lib/action-error";
import { requireActiveMember } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { guideSearchMisses } from "@/lib/db/schema";
import { MISS_RETENTION_DAYS, missQuery } from "@/lib/guide/search-misses";
import { t } from "@/lib/i18n";

// A guide search found nothing: count its words, never who searched (the
// session is checked only so strangers cannot fill the table). Words that
// could identify someone are dropped (missQuery). Fire-and-forget for the
// search box: it ignores the result.
export async function recordGuideSearchMiss(raw: string): Promise<{ error?: string }> {
  try {
    await requireActiveMember();
    const query = missQuery(String(raw ?? ""));
    if (!query) return {};
    const db = getDb();
    const now = new Date();
    const cutoff = new Date(now.getTime() - MISS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await db.batch([
      db.delete(guideSearchMisses).where(lt(guideSearchMisses.lastAt, cutoff)),
      db
        .insert(guideSearchMisses)
        .values({ query, count: 1, lastAt: now })
        .onConflictDoUpdate({
          target: guideSearchMisses.query,
          set: { count: sql`${guideSearchMisses.count} + 1`, lastAt: now },
        }),
    ]);
    return {};
  } catch (e) {
    return { error: actionErrorMessage(e, t.errors.genericError, "recordGuideSearchMiss") };
  }
}

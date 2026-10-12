import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { groupIdentity } from "@/lib/db/schema";
import { brand } from "./index";
import { mergeIdentity, readStoredOverrides, type IdentityOverrides, type LogoType, type StoredLogo } from "./identity";
import type { BrandConfig } from "./types";

export type GroupIdentityState = {
  overrides: IdentityOverrides;
  logo: StoredLogo | null;
  setupCompletedAt: Date | null;
};

const EMPTY: GroupIdentityState = { overrides: {}, logo: null, setupCompletedAt: null };

// The admins' identity row, without the logo's bytes. No database, or a
// database without the table yet (migration 0034 pending): the brand JSON
// alone, so the app still renders.
// Read per request (connection()): a page must never be prerendered with the
// identity of the build. Outside a request (a script, a test) connection()
// throws a plain error, ignored; Next's own signals are rethrown.
export const getGroupIdentity = cache(async (): Promise<GroupIdentityState> => {
  try {
    await connection();
  } catch (e) {
    unstable_rethrow(e);
  }
  try {
    const [row] = await getDb()
      .select({
        overrides: groupIdentity.overrides,
        logoType: groupIdentity.logoType,
        logoUpdatedAt: groupIdentity.logoUpdatedAt,
        setupCompletedAt: groupIdentity.setupCompletedAt,
      })
      .from(groupIdentity)
      .where(eq(groupIdentity.id, 1))
      .limit(1);
    if (!row) return EMPTY;
    return {
      overrides: readStoredOverrides(row.overrides),
      logo: row.logoType && row.logoUpdatedAt ? { type: row.logoType as LogoType, updatedAt: row.logoUpdatedAt } : null,
      setupCompletedAt: row.setupCompletedAt,
    };
  } catch {
    return EMPTY;
  }
});

// The brand in force for this request: NEXT_PUBLIC_BRAND_JSON with what the
// admins set in the app. Server only; use it instead of `brand` for anything
// the admins can change (names, contacts, links, logo, colours). `brand`
// stays right for locale and currency, fixed per deploy.
export const getBrand = cache(async (): Promise<BrandConfig> => {
  const identity = await getGroupIdentity();
  return mergeIdentity(brand, identity.overrides, identity.logo);
});

// The uploaded logo's bytes, for the route that serves it.
export async function getLogoBytes(): Promise<{ type: LogoType; bytes: Buffer } | null> {
  const [row] = await getDb()
    .select({ logoBase64: groupIdentity.logoBase64, logoType: groupIdentity.logoType })
    .from(groupIdentity)
    .where(eq(groupIdentity.id, 1))
    .limit(1);
  if (!row?.logoBase64 || !row.logoType) return null;
  return { type: row.logoType as LogoType, bytes: Buffer.from(row.logoBase64, "base64") };
}

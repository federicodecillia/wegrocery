import { cache } from "react";
import { eq } from "drizzle-orm";
import { getBrand } from "@/lib/brand/get-brand";
import { getDb } from "@/lib/db/client";
import { members } from "@/lib/db/schema";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { mustAcceptTerms } from "./terms";

/**
 * Whether the person who signed in (never the family account they work on)
 * still has to accept the group's privacy notice and terms. AppShell shows
 * the box instead of the page; saveOrder, startOrderPayment and
 * startOnlineTopup refuse with "terms_required" while it is true.
 */
export const termsPending = cache(async (personId: string): Promise<boolean> => {
  const settings = await getPaymentSettings();
  if (!settings.termsRequired || !settings.termsVersion) return false;
  const [brand, [person]] = await Promise.all([
    getBrand(),
    getDb()
      .select({ version: members.termsAcceptedVersion })
      .from(members)
      .where(eq(members.memberId, personId))
      .limit(1),
  ]);
  return mustAcceptTerms(settings, brand, person?.version ?? null);
});

import { cache } from "react";
import { eq } from "drizzle-orm";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { resolveStripeKey } from "./config";
import { resolvePaymentSettings, type PaymentSettings } from "./settings";

// The payment settings in force: the admins' row, else the brand defaults,
// with this deploy's Stripe key. Every reader goes through here, never
// brand.minBalance, brand.bankTransfer or the key directly. cache(): one query
// per request, however many components and actions ask.
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  return resolvePaymentSettings(row ?? null, brand, resolveStripeKey(process.env));
});

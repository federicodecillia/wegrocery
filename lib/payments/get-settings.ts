import { cache } from "react";
import { eq } from "drizzle-orm";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { getStripeCredentials } from "./stripe-credentials";
import { resolvePaymentSettings, type PaymentSettings } from "./settings";

// The payment settings in force: the admins' row, else the brand defaults,
// with this deploy's Stripe key (the env's, else the in-app connection). Every
// reader goes through here, never brand.minBalance, brand.bankTransfer or the
// key directly. cache(): one query per request, however many components and
// actions ask.
export const getPaymentSettings = cache(async (): Promise<PaymentSettings> => {
  const [[row], credentials] = await Promise.all([
    getDb().select().from(appSettings).where(eq(appSettings.id, 1)).limit(1),
    getStripeCredentials(),
  ]);
  return resolvePaymentSettings(row ?? null, brand, credentials.status);
});

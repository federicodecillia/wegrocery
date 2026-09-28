import { t } from "@/lib/i18n";
import { zonedLocalToUtc } from "@/lib/i18n/zoned-time";

type CycleDateInput = { orderCloseAt?: string; pickupDate?: string; pickup2Date?: string };

type CycleDates = {
  orderCloseAt: Date | undefined;
  pickupDate: Date | null | undefined;
  pickup2Date: Date | null | undefined;
};

// Parses the cycle form's wall-clock strings (APP_TIME_ZONE) into instants.
// undefined = key absent, leave the column alone; "" = pickup cleared (the
// close date is required). A non-empty value that does not parse is an error:
// mapping it to null would silently wipe the saved date and report success.
export function parseCycleDates(input: CycleDateInput): CycleDates | { error: string } {
  const out: CycleDates = { orderCloseAt: undefined, pickupDate: undefined, pickup2Date: undefined };

  if (input.orderCloseAt !== undefined) {
    if (!input.orderCloseAt) return { error: t.errors.fieldRequired(t.fields.orderCloseDate) };
    const closeAt = zonedLocalToUtc(input.orderCloseAt);
    if (!closeAt) return { error: t.errors.invalidDate(t.fields.orderCloseDate) };
    out.orderCloseAt = closeAt;
  }

  for (const key of ["pickupDate", "pickup2Date"] as const) {
    const raw = input[key];
    if (raw === undefined) continue;
    const parsed = zonedLocalToUtc(raw);
    if (raw && !parsed) return { error: t.errors.invalidDate(t.fields.pickupDate) };
    out[key] = parsed;
  }

  return out;
}

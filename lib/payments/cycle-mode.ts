import type { PaymentMode } from "./settings";

// The payment mode of a new cycle (docs: "Payment mode per cycle"). The
// group's mode in Impostazioni is the default; a wallet group may also run
// single cycles paid by card, with the same rules as pay-per-order, when this
// deploy's Stripe key works and the group counts in euros (the fee and
// Stripe's minimums are set for the euro). A pay-per-order group has no
// wallet to fall back on, so every cycle stays paid by card. A wallet group
// can switch card cycles off in Impostazioni (app_settings.card_cycles_enabled,
// drizzle/0038) while it has not decided to take card payments yet.

export type NewCycleModeContext = {
  groupMode: PaymentMode;
  stripeUsable: boolean;
  currency: string;
  cardCyclesEnabled: boolean;
};

// Whether this deploy could run card cycles in a wallet group: what decides
// if Impostazioni shows the switch at all.
export function cardCyclesAvailable(ctx: Omit<NewCycleModeContext, "cardCyclesEnabled">): boolean {
  return ctx.groupMode === "wallet" && ctx.stripeUsable && ctx.currency.toUpperCase() === "EUR";
}

// Whether "Nuovo ciclo" offers Carta: available and not switched off.
export function cardCyclesSelectable(ctx: NewCycleModeContext): boolean {
  return cardCyclesAvailable(ctx) && ctx.cardCyclesEnabled;
}

// What the admin asked for, checked again on the server. Omitted or empty:
// the group's mode.
export function resolveNewCycleMode(
  requested: string | undefined,
  ctx: NewCycleModeContext,
): { mode: PaymentMode } | { error: "invalid" | "card_unavailable" } {
  if (requested === undefined || requested === "") return { mode: ctx.groupMode };
  if (requested !== "wallet" && requested !== "per_order") return { error: "invalid" };
  if (requested === ctx.groupMode) return { mode: requested };
  if (requested === "per_order" && cardCyclesSelectable(ctx)) return { mode: "per_order" };
  return { error: requested === "per_order" ? "card_unavailable" : "invalid" };
}

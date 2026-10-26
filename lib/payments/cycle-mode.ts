import type { PaymentMode } from "./settings";

// The payment mode of a new cycle (docs: "Payment mode per cycle"). The
// group's mode in Impostazioni is the default; a wallet group may also run
// single cycles paid by card, with the same rules as pay-per-order, when this
// deploy's Stripe key works and the group counts in euros (the fee and
// Stripe's minimums are set for the euro). A pay-per-order group has no
// wallet to fall back on, so every cycle stays paid by card. A wallet group
// can switch card cycles off in Impostazioni (app_settings.card_cycles_enabled,
// drizzle/0038) while it has not decided to take card payments yet, or make
// Carta the mode new cycles start from (app_settings.new_cycle_payment_mode,
// drizzle/0043) while keeping the wallet: cycles already created keep theirs.

export type NewCycleModeContext = {
  groupMode: PaymentMode;
  stripeUsable: boolean;
  currency: string;
  cardCyclesEnabled: boolean;
  // The mode "Nuovo ciclo" preselects; null or omitted = the group's.
  newCycleMode?: PaymentMode | null;
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

// The mode a new cycle starts from: Carta when the group chose it and card
// cycles are possible right now, else the group's mode (a key that stops
// working falls back to the wallet by itself).
export function defaultNewCycleMode(ctx: NewCycleModeContext): PaymentMode {
  if (ctx.newCycleMode === "per_order" && cardCyclesSelectable(ctx)) return "per_order";
  return ctx.groupMode;
}

// What the admin asked for, checked again on the server. Omitted or empty:
// the default above.
export function resolveNewCycleMode(
  requested: string | undefined,
  ctx: NewCycleModeContext,
): { mode: PaymentMode } | { error: "invalid" | "card_unavailable" } {
  if (requested === undefined || requested === "") return { mode: defaultNewCycleMode(ctx) };
  if (requested !== "wallet" && requested !== "per_order") return { error: "invalid" };
  if (requested === ctx.groupMode) return { mode: requested };
  if (requested === "per_order" && cardCyclesSelectable(ctx)) return { mode: "per_order" };
  return { error: requested === "per_order" ? "card_unavailable" : "invalid" };
}

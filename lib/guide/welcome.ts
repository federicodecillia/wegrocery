// The welcome card on Home (components/home/welcome-card.tsx): which short
// steps a newcomer sees, following the deploy's settings like the guide does.
// Pure; the texts are in lib/i18n (t.welcome).

export type WelcomeStep = "balance" | "pay" | "order" | "install" | "help";

// How the member pays: a wallet (balance), each order by card, or outside the
// app (a pay-per-order member with pays_offline: no money step to explain).
export type WelcomeMoney = "wallet" | "per_order" | "offline";

export function welcomeMoney(mode: "wallet" | "per_order", paysOffline: boolean): WelcomeMoney {
  if (mode === "wallet") return "wallet";
  return paysOffline ? "offline" : "per_order";
}

// install: a phone or tablet where the app is not opened from the home
// screen yet (decided in the browser).
export function welcomeSteps(money: WelcomeMoney, install: boolean): WelcomeStep[] {
  const steps: WelcomeStep[] = [];
  if (money === "wallet") steps.push("balance");
  if (money === "per_order") steps.push("pay");
  steps.push("order");
  if (install) steps.push("install");
  steps.push("help");
  return steps;
}

// Where each step's link goes: a page of the app or a guide card.
export const WELCOME_LINKS: Record<WelcomeStep, string> = {
  balance: "/ricarica",
  pay: "/guida/soldi#come-si-paga",
  order: "/ordine",
  install: "/guida/primi-passi#installare-app",
  help: "/guida",
};

// The guide's "Rivedi il benvenuto" opens Home with this query.
export const WELCOME_QUERY = "benvenuto";

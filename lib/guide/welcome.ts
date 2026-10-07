// The welcome card on Home (components/home/welcome-card.tsx): which short
// steps a newcomer sees, following the deploy's settings like the guide does.
// Pure; the texts are in lib/i18n (t.welcome).

export type WelcomeStep = "intro" | "balance" | "pay" | "order" | "pickup" | "notify" | "family" | "install" | "help";

// How the member pays: a wallet (balance), each order by card, or outside the
// app (a pay-per-order member with pays_offline: no money step to explain).
export type WelcomeMoney = "wallet" | "per_order" | "offline";

export function welcomeMoney(mode: "wallet" | "per_order", paysOffline: boolean): WelcomeMoney {
  if (mode === "wallet") return "wallet";
  return paysOffline ? "offline" : "per_order";
}

export type WelcomeOptions = {
  money: WelcomeMoney;
  families: boolean;
  // A phone or tablet where the app is not opened from the home screen yet
  // (decided in the browser).
  install: boolean;
};

export function welcomeSteps({ money, families, install }: WelcomeOptions): WelcomeStep[] {
  const steps: WelcomeStep[] = ["intro"];
  if (money === "wallet") steps.push("balance");
  if (money === "per_order") steps.push("pay");
  steps.push("order", "pickup", "notify");
  if (families) steps.push("family");
  if (install) steps.push("install");
  steps.push("help");
  return steps;
}

// Where each step's link goes: a page of the app or a guide card.
export const WELCOME_LINKS: Record<WelcomeStep, string> = {
  intro: "/guida/primi-passi#com-e-fatta",
  balance: "/ricarica",
  pay: "/guida/soldi#come-si-paga",
  order: "/ordine",
  pickup: "/storico",
  notify: "/profilo/notifiche",
  family: "/famiglia",
  install: "/guida/primi-passi#installare-app",
  help: "/guida",
};

// The guide's "Rivedi il benvenuto" and the "Riprendi" bar open Home with
// this query.
export const WELCOME_QUERY = "benvenuto";

// sessionStorage key holding the step a member left the card on to follow
// one of its links: the bar on the other pages offers to resume it there.
export const WELCOME_STORAGE_KEY = "wegrocery.welcome-step";

export function isWelcomeStep(value: string | null): value is WelcomeStep {
  return value !== null && Object.prototype.hasOwnProperty.call(WELCOME_LINKS, value);
}

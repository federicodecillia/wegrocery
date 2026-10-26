import { ChevronDown } from "lucide-react";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { getGuideSearchMisses, getLastHandlingFee } from "@/lib/db/queries";
import { formatAmountInput } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { cardCyclesAvailable } from "@/lib/payments/cycle-mode";
import { newCyclePaymentChoice, startingFee } from "@/lib/payments/new-cycle-defaults";
import { DEFAULT_HANDLING_FEE } from "@/lib/payments/order-payment";
import { modeChangeBlockers, readModeChangeState } from "@/lib/payments/mode-change";
import { getConfigStatus } from "@/lib/config-status-server";
import { getBrand, getGroupIdentity } from "@/lib/brand/get-brand";
import { IdentityForm } from "./identity-form";
import { CardSettlesWalletCard } from "./card-settles-wallet-card";
import { ConfigStatusCard } from "./config-status-card";
import { FamiliesCard } from "./families-card";
import { NamePromptCard } from "./name-prompt-card";
import { NewCyclesCard } from "./new-cycles-card";
import { GroupInfoCard } from "./group-info-card";
import { PaymentSettingsForm } from "./impostazioni-form";
import { PaymentModeCard } from "./payment-mode-card";
import { SearchMissesCard } from "./search-misses-card";
import { SetupBanner } from "./setup/setup-banner";
import { StripeConnectionCard } from "./stripe-connection-card";

// An amount in euros as the form's text input shows it; "" = no limit.
function toInput(euros: number | null): string {
  return euros === null ? "" : formatAmountInput(euros);
}

// Payments in sections, in the order an admin decides them: how new cycles
// are paid and what they cost, card (Stripe), bank transfer, wallet limits,
// and the group's mode under Avanzate. Shared with the first-run setup
// (app/admin/avvio).
export async function PaymentSettingsSection() {
  const [settings, modeState] = await Promise.all([getPaymentSettings(), readModeChangeState(getDb())]);
  const savedAt = settings.savedAt?.toISOString() ?? null;
  const cardContext = {
    groupMode: settings.mode,
    stripeUsable: settings.stripeKey.usable,
    currency: brand.currency,
    cardCyclesEnabled: settings.cardCyclesEnabled,
    newCycleMode: settings.newCycleMode,
  };
  const cardAvailable = cardCyclesAvailable(cardContext);
  const [lastWalletFee, lastCardFee] = await Promise.all([
    getLastHandlingFee("wallet"),
    getLastHandlingFee("per_order"),
  ]);
  const blockers = modeChangeBlockers({
    target: settings.mode === "wallet" ? "per_order" : "wallet",
    currency: brand.currency,
    stripeUsable: settings.stripeKey.usable,
    runningCycles: modeState.runningCycles,
    unsettledCycles: modeState.unsettledCycles,
  });
  const initial = {
    // Asked as a positive overdraft: -50 € shows as "50".
    maxOverdraft: toInput(settings.minBalance === null ? null : -settings.minBalance),
    maxBalance: toInput(settings.maxBalance),
    bankTransferEnabled: settings.bankTransferEnabled,
    bankHolder: settings.bankHolder ?? "",
    bankIban: settings.bankIban ?? "",
    bankReferenceTemplate: settings.bankReferenceTemplate ?? "",
    bankReceiptEmail: settings.bankReceiptEmail ?? "",
    onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
  };
  // A save remounts the forms with the values as stored (IBAN compacted).
  const formKey = savedAt ?? "defaults";
  const s = t.admin.settings.paymentSections;
  return (
    <>
      {savedAt === null && (
        <p className="rounded-lg border border-primary/40 bg-primary-bg px-3 py-2 text-[12px] text-foreground">
          {t.admin.settings.defaultsNotice}
        </p>
      )}
      <SectionTitle>{s.newCycles}</SectionTitle>
      <NewCyclesCard
        key={`${formKey}-${settings.cardCyclesEnabled}-${settings.newCycleMode}`}
        groupMode={settings.mode}
        cardAvailable={cardAvailable}
        stripeMissing={settings.mode === "wallet" && !settings.stripeKey.usable && brand.currency.toUpperCase() === "EUR"}
        choice={newCyclePaymentChoice(settings.cardCyclesEnabled, settings.newCycleMode)}
        defaults={settings.newCycleDefaults}
        startFees={{
          wallet: startingFee(settings.newCycleDefaults, "wallet", lastWalletFee),
          per_order: startingFee(settings.newCycleDefaults, "per_order", lastCardFee) ?? DEFAULT_HANDLING_FEE,
        }}
      />
      <SectionTitle>{s.card}</SectionTitle>
      <StripeConnectionCard />
      <PaymentSettingsForm key={`online-${formKey}`} part="online" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
      {(settings.mode === "per_order" || cardAvailable) && <CardSettlesWalletCard enabled={settings.cardSettlesWallet} />}
      <SectionTitle>{s.bank}</SectionTitle>
      <PaymentSettingsForm key={`bank-${formKey}`} part="bank" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
      {settings.mode === "wallet" && (
        <>
          <SectionTitle>{s.wallet}</SectionTitle>
          <PaymentSettingsForm key={`limits-${formKey}`} part="limits" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
        </>
      )}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[13px] font-bold text-foreground">
          <span>
            <span className="block text-label font-semibold uppercase tracking-wide text-secondary-foreground">{s.advanced}</span>
            {s.advancedSummary}
          </span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 [&>section]:border-0 [&>section]:p-0 [&>section>h3]:sr-only">
          <PaymentModeCard mode={settings.mode} state={modeState} blockers={blockers} cardCycles={settings.mode === "wallet"} />
        </div>
      </details>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 pt-2 text-label font-semibold uppercase tracking-wide text-secondary-foreground">{children}</h2>
  );
}

// The deploy's brand JSON and what the admins saved over it, for the identity forms.
export async function IdentitySection({ section }: { section: "identity" | "contacts" }) {
  const [current, identity] = await Promise.all([getBrand(), getGroupIdentity()]);
  return (
    <IdentityForm
      // A save remounts the form with the values as stored.
      key={JSON.stringify(identity.overrides) + (identity.logo?.updatedAt.getTime() ?? "")}
      section={section}
      defaults={brand}
      current={identity.overrides}
      logoUrl={current.logoUrl}
      uploadedLogo={identity.logo !== null}
    />
  );
}

export async function TabImpostazioni() {
  const [settings, config, misses] = await Promise.all([getPaymentSettings(), getConfigStatus(), getGuideSearchMisses()]);
  return (
    <div className="space-y-4">
      <SetupBanner revisit />
      <IdentitySection section="identity" />
      <IdentitySection section="contacts" />
      <PaymentSettingsSection />
      <FamiliesCard enabled={settings.familiesEnabled} />
      <NamePromptCard mode={settings.memberNamePrompt} />
      <GroupInfoCard key={settings.groupInfo ?? ""} initial={settings.groupInfo} />
      <SearchMissesCard misses={misses} />
      <ConfigStatusCard items={config} />
    </div>
  );
}

import { ChevronDown } from "lucide-react";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { getDb } from "@/lib/db/client";
import { getGuideSearchMisses, getLastHandlingFee } from "@/lib/db/queries";
import { formatAmountInput, formatMoney } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { cardCyclesAvailable } from "@/lib/payments/cycle-mode";
import { newCyclePaymentChoice, startingFee } from "@/lib/payments/new-cycle-defaults";
import { DEFAULT_HANDLING_FEE } from "@/lib/payments/order-payment";
import { modeChangeBlockers, readModeChangeState } from "@/lib/payments/mode-change";
import { getConfigStatus } from "@/lib/config-status-server";
import { getBrand, getGroupIdentity } from "@/lib/brand/get-brand";
import { resolvePalette } from "@/lib/brand/roles";
import type { SettingsView } from "@/lib/admin/nav";
import { configBlocking, configIssues, ibanTail, stripeSummary } from "@/lib/admin/settings-summary";
import { getStripeCredentials } from "@/lib/payments/stripe-credentials";
import { IdentityForm } from "./identity-form";
import { CardSettlesWalletCard } from "./card-settles-wallet-card";
import { WalletTopupsCard } from "./wallet-topups-card";
import { ConfigStatusCard } from "./config-status-card";
import { FamiliesCard } from "./families-card";
import { NamePromptCard } from "./name-prompt-card";
import { NewCyclesCard } from "./new-cycles-card";
import { GroupInfoCard } from "./group-info-card";
import { PaymentSettingsForm } from "./impostazioni-form";
import { PaymentModeCard } from "./payment-mode-card";
import { SearchMissesCard } from "./search-misses-card";
import { ColorDots, SettingsPanel } from "./settings-panel";
import { SetupBanner } from "./setup/setup-banner";
import { StripeConnectionCard } from "./stripe-connection-card";

// An amount in euros as the form's text input shows it; "" = no limit.
function toInput(euros: number | null): string {
  return euros === null ? "" : formatAmountInput(euros);
}

// Payments in sections, in the order an admin decides them: how new cycles
// are paid and what they cost, card (Stripe), bank transfer, wallet limits,
// and the group's mode under Avanzate. In Impostazioni each one is a folded
// panel with what is set now (only the first open); the first-run setup
// (app/admin/avvio) shows them as cards, open, to fill in.
export async function PaymentSettingsSection({ panels = false }: { panels?: boolean }) {
  const [settings, modeState, credentials] = await Promise.all([
    getPaymentSettings(),
    readModeChangeState(getDb()),
    getStripeCredentials(),
  ]);
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
  const sum = t.admin.settings.summaries;
  const choice = newCyclePaymentChoice(settings.cardCyclesEnabled, settings.newCycleMode);
  const stripe = stripeSummary({
    source: credentials.source,
    unreadable: credentials.source === "app" && credentials.unreadable,
    usable: settings.stripeKey.usable,
  });
  const cardSummary =
    stripe.state === "none"
      ? sum.stripeNotConnected
      : stripe.state === "check"
        ? sum.stripeCheck
        : [
            sum.stripeConnected,
            settings.stripeKey.usable && settings.stripeKey.livemode ? sum.live : sum.test,
            settings.onlinePaymentsEnabled ? sum.onlineOn : sum.onlineOff,
          ].join(" · ");
  const limit = (euros: number | null) => (euros === null ? sum.noLimit : formatMoney(euros));
  const modeName = settings.mode === "wallet" ? t.admin.settings.mode.walletName : t.admin.settings.mode.perOrderName;

  return (
    <>
      {savedAt === null && (
        <p className="rounded-lg border border-primary/40 bg-primary-bg px-3 py-2 text-[12px] text-foreground">
          {t.admin.settings.defaultsNotice}
        </p>
      )}
      <PaymentBlock
        panels={panels}
        id="nuovi-cicli"
        title={panels ? t.admin.settings.newCycles.title : s.newCycles}
        summary={
          settings.mode === "per_order"
            ? sum.perOrderCycles
            : t.admin.settings.newCycles.choices[cardAvailable ? choice : "wallet_only"].label
        }
        open
      >
        <NewCyclesCard
          key={`${formKey}-${settings.cardCyclesEnabled}-${settings.newCycleMode}`}
          groupMode={settings.mode}
          cardAvailable={cardAvailable}
          stripeMissing={settings.mode === "wallet" && !settings.stripeKey.usable && brand.currency.toUpperCase() === "EUR"}
          choice={choice}
          defaults={settings.newCycleDefaults}
          startFees={{
            wallet: startingFee(settings.newCycleDefaults, "wallet", lastWalletFee),
            per_order: startingFee(settings.newCycleDefaults, "per_order", lastCardFee) ?? DEFAULT_HANDLING_FEE,
          }}
        />
      </PaymentBlock>
      <PaymentBlock panels={panels} id="carta" title={s.card} summary={cardSummary} attention={stripe.attention} stacked>
        <StripeConnectionCard />
        <PaymentSettingsForm key={`online-${formKey}`} part="online" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
        {(settings.mode === "per_order" || cardAvailable) && <CardSettlesWalletCard enabled={settings.cardSettlesWallet} />}
      </PaymentBlock>
      <PaymentBlock
        panels={panels}
        id="bonifico"
        title={s.bank}
        summary={settings.bankTransferEnabled ? sum.bankOn(ibanTail(settings.bankIban)) : sum.bankOff}
      >
        <PaymentSettingsForm key={`bank-${formKey}`} part="bank" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
      </PaymentBlock>
      {settings.mode === "wallet" && (
        <PaymentBlock
          panels={panels}
          id="borsellino"
          title={s.wallet}
          summary={[
            ...(settings.walletTopupsEnabled ? [] : [sum.topupsOff]),
            sum.limits(limit(settings.minBalance === null ? null : -settings.minBalance), limit(settings.maxBalance)),
          ].join(" · ")}
          stacked
        >
          <WalletTopupsCard
            enabled={settings.walletTopupsEnabled}
            suggestCardSettles={cardAvailable && !settings.cardSettlesWallet}
          />
          <PaymentSettingsForm key={`limits-${formKey}`} part="limits" initial={initial} stripeKey={settings.stripeKey} savedAt={savedAt} />
        </PaymentBlock>
      )}
      {panels ? (
        <SettingsPanel id="avanzate" title={s.advanced} summary={sum.groupMode(modeName)}>
          <PaymentModeCard mode={settings.mode} state={modeState} blockers={blockers} cardCycles={settings.mode === "wallet"} />
        </SettingsPanel>
      ) : (
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
      )}
    </>
  );
}

// A panel in Impostazioni, a titled group of cards in the setup.
function PaymentBlock({
  panels,
  id,
  title,
  summary,
  open,
  attention,
  stacked,
  children,
}: {
  panels: boolean;
  id: string;
  title: string;
  summary: React.ReactNode;
  open?: boolean;
  attention?: boolean;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  if (panels) {
    return (
      <SettingsPanel id={id} title={title} summary={summary} defaultOpen={open} attention={attention} stacked={stacked}>
        {children}
      </SettingsPanel>
    );
  }
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {children}
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

// Admin → Impostazioni, by topic (the views in lib/admin/nav.ts): payments,
// the group's look and contacts, members and the guide, the technical state.
export async function TabImpostazioni({ view }: { view: SettingsView }) {
  return (
    <div className="space-y-3">
      {view === "pagamenti" && <PaymentSettingsSection panels />}
      {view === "gruppo" && <GroupView />}
      {view === "soci" && <MembersView />}
      {view === "tecniche" && <TechnicalView />}
    </div>
  );
}

async function GroupView() {
  const [current, identity] = await Promise.all([getBrand(), getGroupIdentity()]);
  const s = t.admin.settings.identity;
  const sum = t.admin.settings.summaries;
  const palette = resolvePalette(current.theme);
  return (
    <>
      <SettingsPanel
        id="aspetto"
        title={s.title}
        summary={
          <>
            {current.appName} · {identity.logo ? sum.logoUploaded : sum.logoDefault}
            <ColorDots colors={[palette.primary, palette.accent, palette.background]} />
          </>
        }
      >
        <IdentitySection section="identity" />
      </SettingsPanel>
      <SettingsPanel
        id="contatti"
        title={s.contacts}
        summary={current.supportEmail ? sum.supportEmail(current.supportEmail) : sum.noSupportEmail}
      >
        <IdentitySection section="contacts" />
      </SettingsPanel>
    </>
  );
}

async function MembersView() {
  const [settings, misses] = await Promise.all([getPaymentSettings(), getGuideSearchMisses()]);
  const s = t.admin.settings;
  const sum = s.summaries;
  return (
    <>
      <SettingsPanel id="nome-soci" title={s.namePrompt.title} summary={s.namePrompt.modes[settings.memberNamePrompt].label} defaultOpen>
        <NamePromptCard mode={settings.memberNamePrompt} />
      </SettingsPanel>
      <SettingsPanel id="famiglie" title={s.families.title} summary={settings.familiesEnabled ? s.families.on : s.families.off} defaultOpen>
        <FamiliesCard enabled={settings.familiesEnabled} />
      </SettingsPanel>
      <SettingsPanel
        id="il-nostro-gruppo"
        title={s.groupInfo.title}
        summary={settings.groupInfo ? sum.groupInfoSet(settings.groupInfo.length) : s.groupInfo.empty}
      >
        <GroupInfoCard key={settings.groupInfo ?? ""} initial={settings.groupInfo} />
      </SettingsPanel>
      <SettingsPanel
        id="ricerche"
        title={s.searchMisses.title}
        summary={misses.length > 0 ? sum.misses(misses.length) : s.searchMisses.empty}
      >
        <SearchMissesCard misses={misses} />
      </SettingsPanel>
    </>
  );
}

async function TechnicalView() {
  const config = await getConfigStatus();
  const issues = configIssues(config);
  const sum = t.admin.settings.summaries;
  return (
    <>
      <SettingsPanel
        id="configurazione"
        title={sum.configTitle}
        summary={issues === 0 ? sum.configOk : sum.configIssues(issues)}
        attention={configBlocking(config)}
      >
        <ConfigStatusCard items={config} bare />
      </SettingsPanel>
      <SetupBanner revisit />
    </>
  );
}

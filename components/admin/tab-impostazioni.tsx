import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { getGuideSearchMisses } from "@/lib/db/queries";
import { formatAmountInput } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { cardCyclesSelectable } from "@/lib/payments/cycle-mode";
import { modeChangeBlockers, readModeChangeState } from "@/lib/payments/mode-change";
import { getConfigStatus } from "@/lib/config-status-server";
import { getBrand, getGroupIdentity } from "@/lib/brand/get-brand";
import { IdentityForm } from "./identity-form";
import { ConfigStatusCard } from "./config-status-card";
import { FamiliesCard } from "./families-card";
import { GroupInfoCard } from "./group-info-card";
import { PaymentSettingsForm } from "./impostazioni-form";
import { PaymentModeCard } from "./payment-mode-card";
import { SearchMissesCard } from "./search-misses-card";
import { SetupBanner } from "./setup/setup-banner";

// An amount in euros as the form's text input shows it; "" = no limit.
function toInput(euros: number | null): string {
  return euros === null ? "" : formatAmountInput(euros);
}

// The payment mode and the payment settings, shared with the first-run setup
// (app/admin/avvio).
export async function PaymentSettingsSection() {
  const [settings, modeState] = await Promise.all([getPaymentSettings(), readModeChangeState(getDb())]);
  const savedAt = settings.savedAt?.toISOString() ?? null;
  const blockers = modeChangeBlockers({
    target: settings.mode === "wallet" ? "per_order" : "wallet",
    currency: brand.currency,
    stripeUsable: settings.stripeKey.usable,
    runningCycles: modeState.runningCycles,
    unsettledCycles: modeState.unsettledCycles,
  });
  return (
    <>
      <PaymentModeCard
        mode={settings.mode}
        state={modeState}
        blockers={blockers}
        cardCycles={cardCyclesSelectable({
          groupMode: settings.mode,
          stripeUsable: settings.stripeKey.usable,
          currency: brand.currency,
        })}
      />
      <PaymentSettingsForm
        // A save remounts the form with the values as stored (IBAN compacted).
        key={savedAt ?? "defaults"}
        initial={{
          // Asked as a positive overdraft: -50 € shows as "50".
          maxOverdraft: toInput(
            settings.minBalance === null ? null : -settings.minBalance,
          ),
          maxBalance: toInput(settings.maxBalance),
          bankTransferEnabled: settings.bankTransferEnabled,
          bankHolder: settings.bankHolder ?? "",
          bankIban: settings.bankIban ?? "",
          bankReferenceTemplate: settings.bankReferenceTemplate ?? "",
          bankReceiptEmail: settings.bankReceiptEmail ?? "",
          onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
        }}
        stripeKey={settings.stripeKey}
        savedAt={savedAt}
        showLimits={settings.mode === "wallet"}
      />
    </>
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
      <GroupInfoCard key={settings.groupInfo ?? ""} initial={settings.groupInfo} />
      <SearchMissesCard misses={misses} />
      <ConfigStatusCard items={config} />
    </div>
  );
}

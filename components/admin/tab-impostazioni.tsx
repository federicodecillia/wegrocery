import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { formatAmountInput } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { modeChangeBlockers, readModeChangeState } from "@/lib/payments/mode-change";
import { getConfigStatus } from "@/lib/config-status-server";
import { ConfigStatusCard } from "./config-status-card";
import { PaymentSettingsForm } from "./impostazioni-form";
import { PaymentModeCard } from "./payment-mode-card";

// An amount in euros as the form's text input shows it; "" = no limit.
function toInput(euros: number | null): string {
  return euros === null ? "" : formatAmountInput(euros);
}

export async function TabImpostazioni() {
  const [settings, config, modeState] = await Promise.all([
    getPaymentSettings(),
    getConfigStatus(),
    readModeChangeState(getDb()),
  ]);
  const savedAt = settings.savedAt?.toISOString() ?? null;
  const blockers = modeChangeBlockers({
    target: settings.mode === "wallet" ? "per_order" : "wallet",
    currency: brand.currency,
    stripeUsable: settings.stripeKey.usable,
    runningCycles: modeState.runningCycles,
    unsettledCycles: modeState.unsettledCycles,
  });
  return (
    <div className="space-y-4">
      <PaymentModeCard mode={settings.mode} state={modeState} blockers={blockers} />
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
          onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
        }}
        stripeKey={settings.stripeKey}
        savedAt={savedAt}
        showLimits={settings.mode === "wallet"}
      />
      <ConfigStatusCard items={config} />
    </div>
  );
}

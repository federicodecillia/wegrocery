import { formatDecimalInput } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { PaymentSettingsForm } from "./impostazioni-form";

// An amount in euros as the form's text input shows it; "" = no limit.
function toInput(euros: number | null): string {
  return euros === null ? "" : formatDecimalInput(String(euros));
}

export async function TabImpostazioni() {
  const settings = await getPaymentSettings();
  const savedAt = settings.savedAt?.toISOString() ?? null;
  return (
    <PaymentSettingsForm
      // A save remounts the form with the values as stored (IBAN compacted).
      key={savedAt ?? "defaults"}
      initial={{
        // Asked as a positive overdraft: -50 € shows as "50".
        maxOverdraft: toInput(settings.minBalance === null ? null : -settings.minBalance),
        maxBalance: toInput(settings.maxBalance),
        bankTransferEnabled: settings.bankTransferEnabled,
        bankHolder: settings.bankHolder ?? "",
        bankIban: settings.bankIban ?? "",
        onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
      }}
      stripeKey={settings.stripeKey}
      savedAt={savedAt}
    />
  );
}

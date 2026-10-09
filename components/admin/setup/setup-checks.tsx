"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminCheckStripeWebhook, adminSendTestEmail, type StripeSetupCheck } from "@/lib/actions/admin-identity";
import { t } from "@/lib/i18n";

// First-run setup → Verifiche: try the email and the Stripe webhook with the
// deploy's own keys. Nothing is stored or shown but the outcome.
export function SetupChecks({ adminEmail, webhookUrl }: { adminEmail: string; webhookUrl: string | null }) {
  const s = t.admin.setup.checks;
  const [sending, startSend] = useTransition();
  const [checking, startCheck] = useTransition();
  const [stripe, setStripe] = useState<StripeSetupCheck | null>(null);

  function sendTest() {
    startSend(async () => {
      const result = await adminSendTestEmail();
      if (result.error) toast.error(result.error);
      else toast.success(s.testEmailSent);
    });
  }

  function checkStripe() {
    startCheck(async () => setStripe(await adminCheckStripeWebhook()));
  }

  return (
    <section className="space-y-4 rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <p className="text-[13px] text-brand-gray">{s.intro}</p>
      <div>
        <button
          type="button"
          onClick={sendTest}
          disabled={sending}
          className="min-h-11 rounded-xl bg-brand-near-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {sending ? t.admin.common.sending : s.testEmail}
        </button>
        <p className="mt-1 text-[12px] text-brand-gray">{s.testEmailHint(adminEmail)}</p>
      </div>
      <div>
        <button
          type="button"
          onClick={checkStripe}
          disabled={checking}
          className="min-h-11 rounded-xl border border-brand-border px-4 py-2 text-[13px] font-bold text-brand-near-black disabled:opacity-60"
        >
          {checking ? t.admin.common.loading : s.stripeCheck}
        </button>
        {stripe && <StripeOutcome result={stripe} webhookUrl={webhookUrl} />}
      </div>
    </section>
  );
}

function StripeOutcome({ result, webhookUrl }: { result: StripeSetupCheck; webhookUrl: string | null }) {
  const s = t.admin.setup.checks;
  const good = result.status === "ok" || result.status === "off";
  const text =
    result.status === "ok"
      ? s.stripeOk
      : result.status === "off"
        ? s.stripeOff
        : result.status === "missingEndpoint"
          ? s.stripeMissingEndpoint(webhookUrl ?? "")
          : result.status === "disabled"
            ? s.stripeDisabled
            : result.status === "missingEvents"
              ? s.stripeMissingEvents
              : result.status === "noBaseUrl"
                ? s.stripeNoBaseUrl
                : s.stripeUnverifiable;
  return (
    <div role="status" className={`mt-2 rounded-lg p-3 text-[13px] ${good ? "bg-accent-soft text-accent-text" : "bg-brand-red-light text-brand-red"}`}>
      <p>{text}</p>
      {result.status === "missingEvents" && (
        <ul className="mt-1 list-disc pl-4 font-mono text-label">
          {result.missing.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

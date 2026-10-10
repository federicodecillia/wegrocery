import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { getStripeCredentials } from "@/lib/payments/stripe-credentials";
import { StripeConnectForm } from "./stripe-connect-form";

const card = "rounded-xl border border-brand-border bg-white p-4 shadow-sm";

function ModeBadge({ livemode }: { livemode: boolean }) {
  const s = t.admin.settings.stripeConnection;
  return livemode ? (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-label font-semibold text-accent-text">
      {s.modeLive}
    </span>
  ) : (
    <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-label font-semibold text-primary-text">
      {s.modeTest}
    </span>
  );
}

// Admin → Impostazioni (and the first-run setup's payments step): the
// group's Stripe account. Configured by the host (env, nothing to do here),
// not connected (a guide and the key field), connected, or saved but
// unreadable since AUTH_SECRET changed (connect again).
export async function StripeConnectionCard() {
  const s = t.admin.settings.stripeConnection;
  const credentials = await getStripeCredentials();

  if (credentials.source === "env") {
    return (
      <section className={card}>
        <h3 className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-brand-near-black">
          {s.title}
          {credentials.status.enabled && <ModeBadge livemode={credentials.status.livemode} />}
        </h3>
        <p className="mt-1 text-[12px] text-brand-gray">{s.hostManaged}</p>
        {!credentials.status.enabled && (
          <p className="mt-2 rounded-lg bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">
            {t.admin.settings.stripeUnavailable[credentials.status.reason]}
          </p>
        )}
      </section>
    );
  }

  if (credentials.source === "none") {
    return (
      <section className={card}>
        <h3 className="text-[13px] font-bold text-brand-near-black">{s.title}</h3>
        <p className="mt-1 text-[12px] text-brand-near-black">{s.notConnected}</p>
        <p className="mt-1 text-[12px] text-brand-gray">{s.moneyNote}</p>
        <h4 className="mt-3 text-[12px] font-bold text-brand-near-black">{s.stepsTitle}</h4>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12px] leading-snug text-brand-near-black">
          {s.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <StripeConnectForm mode="connect" />
      </section>
    );
  }

  const { connection } = credentials;
  return (
    <section className={card}>
      <h3 className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-brand-near-black">
        {s.title}: {s.connectedTitle}
        {!credentials.unreadable && <ModeBadge livemode={connection.livemode} />}
      </h3>
      <p className="mt-1 text-[12px] text-brand-gray">{s.moneyNote}</p>
      {connection.accountLabel && (
        <p className="mt-1 text-[12px] text-brand-near-black">{s.account(connection.accountLabel)}</p>
      )}
      <p className="mt-1 text-[12px] text-brand-gray">
        {s.since(formatDate(connection.connectedAt), connection.connectedBy)}
      </p>
      {credentials.unreadable ? (
        <p className="mt-2 rounded-lg bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">{s.unreadable}</p>
      ) : (
        !credentials.status.enabled && (
          <p className="mt-2 rounded-lg bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">
            {t.admin.settings.stripeUnavailable[credentials.status.reason]}
          </p>
        )
      )}
      <StripeConnectForm mode={credentials.unreadable ? "reconnect" : "replace"} canDisconnect />
    </section>
  );
}

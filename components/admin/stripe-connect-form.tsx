"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { adminConnectStripe, adminDisconnectStripe } from "@/lib/actions/admin-stripe";
import { t } from "@/lib/i18n";

const labelCls = "mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray";
const helpCls = "mt-1 text-label leading-snug text-brand-gray";

// The key field of the Stripe card (stripe-connection-card.tsx), and the
// disconnect button once connected. The key goes to the server action and is
// never kept in the page.
export function StripeConnectForm({
  mode,
  canDisconnect = false,
}: {
  mode: "connect" | "replace" | "reconnect";
  canDisconnect?: boolean;
}) {
  const s = t.admin.settings.stripeConnection;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<"connect" | "disconnect" | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setRunning("connect");
    startTransition(async () => {
      const result = await adminConnectStripe(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      form.reset();
      toast.success(s.connectedToast);
      router.refresh();
    });
  }

  async function handleDisconnect() {
    if (!(await confirm({ title: s.disconnectConfirm, message: s.disconnectMessage, confirmLabel: s.disconnect, danger: true }))) {
      return;
    }
    setError(null);
    setRunning("disconnect");
    startTransition(async () => {
      const result = await adminDisconnectStripe();
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(s.disconnectedToast);
      router.refresh();
    });
  }

  const label = mode === "replace" ? s.replaceLabel : s.keyLabel;
  const help = mode === "replace" ? s.replaceHelp : s.keyHelp;

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit}>
        <label htmlFor="stripe-key" className={labelCls}>
          {label}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="stripe-key"
            name="key"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="rk_test_…"
            required
            aria-describedby="stripe-key-help"
            aria-invalid={error ? true : undefined}
            className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-brand-border px-3 py-2 font-mono text-[13px] text-brand-near-black"
          />
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 shrink-0 rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-on-accent disabled:opacity-60"
          >
            {isPending && running === "connect" ? s.connecting : mode === "connect" ? s.connect : s.reconnect}
          </button>
        </div>
        <p id="stripe-key-help" className={helpCls}>
          {help}
        </p>
      </form>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-brand-red-light px-3 py-2 text-[12px] text-brand-red">
          {error}
        </p>
      )}
      {canDisconnect && (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isPending}
          className="mt-3 min-h-11 rounded-xl border border-brand-border px-4 py-2 text-[13px] font-bold text-brand-red disabled:opacity-60"
        >
          {isPending && running === "disconnect" ? s.disconnecting : s.disconnect}
        </button>
      )}
    </div>
  );
}

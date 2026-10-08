import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BalanceDueCard } from "@/components/balance/balance-due-card";
import { CopyField } from "@/components/ricarica/copy-field";
import { PendingRefresh } from "@/components/ricarica/pending-refresh";
import { TopupForm } from "@/components/ricarica/topup-form";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getMemberById } from "@/lib/db/queries";
import { payments } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { TOPUP_MIN_CENTS, topupBlockReason, topupCeilingCents, topupPresets } from "@/lib/payments/config";
import { getConsolidatedBalanceCents, getWalletBalance } from "@/lib/payments/balance-due";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { SETTLEMENT_MIN_DUE_CENTS } from "@/lib/payments/settlement";
import { HelpLink } from "@/components/guide/help-link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: t.topup.title };

function compactIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

// IT08 J030 6967 ...: easier to check by eye than one 27-character run.
function formatIban(iban: string): string {
  return compactIban(iban).replace(/(.{4})(?=.)/g, "$1 ");
}

type Result = { tone: "ok" | "info" | "error"; text: string; pending?: boolean } | null;

// The success redirect only says "come back and look": what the member sees is
// the payment row, which only the signed webhook moves to succeeded.
async function resultFor(memberId: string, esito?: string, sessionId?: string): Promise<Result> {
  if (esito === "annullato") return { tone: "info", text: t.topup.resultCancelled };
  if (esito !== "ok" || !sessionId) return null;
  const [payment] = await getDb()
    .select({ status: payments.status, amountCents: payments.amountCents, kind: payments.kind })
    .from(payments)
    .where(and(eq(payments.checkoutSessionId, sessionId), eq(payments.memberId, memberId)))
    .limit(1);
  if (!payment) return null;
  const balance = payment.kind === "balance";
  if (payment.status === "pending") {
    return { tone: "info", text: balance ? t.balance.resultPending : t.topup.resultPending, pending: true };
  }
  if (payment.status === "failed" || payment.status === "expired") {
    return { tone: "error", text: t.topup.resultFailed };
  }
  const amount = formatMoney(payment.amountCents / 100);
  return { tone: "ok", text: balance ? t.balance.resultPaid(amount) : t.topup.resultCredited(amount) };
}

const TONE_CLASSES = {
  ok: "border-accent bg-accent-soft text-brand-near-black",
  info: "border-primary-mid bg-primary-soft text-brand-near-black",
  error: "border-brand-red/30 bg-brand-red-light text-brand-red",
} as const;

export default async function RicaricaPage({
  searchParams,
}: {
  searchParams: Promise<{ esito?: string; session_id?: string }>;
}) {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;
  const { esito, session_id } = await searchParams;

  const [result, settings, member] = await Promise.all([
    resultFor(memberId, esito, session_id),
    getPaymentSettings(),
    getMemberById(memberId),
  ]);
  // A pay-per-order group has no wallet to top up: this page shows what is
  // due or the credit. A member who pays outside the app sees the wallet
  // view, with the bank details only.
  const payPerOrder = settings.mode === "per_order";
  if (payPerOrder && !member?.paysOffline) {
    const cents = await getConsolidatedBalanceCents(getDb(), memberId);
    return (
      <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-[22px] font-black tracking-[-0.02em] text-brand-near-black">{t.balance.title}</h1>
          <HelpLink href="/guida/soldi#da-saldare" />
        </div>
        {result && (
          <div className={`mb-4 rounded-[14px] border p-[12px_14px] text-[14px] ${TONE_CLASSES[result.tone]}`}>
            {result.text}
            {result.pending && <PendingRefresh />}
          </div>
        )}
        <BalanceDueCard cents={cents} canPay={settings.onlineTopupAvailable} />
        {cents > -SETTLEMENT_MIN_DUE_CENTS && cents <= 0 && (
          <div className="flex items-center justify-between rounded-card border border-brand-border bg-white p-[18px] shadow-card">
            <span className="text-[14px] text-brand-gray">{t.balance.nothingDue}</span>
            <Link href="/ordine" className="rounded-full bg-primary px-4 py-[10px] text-[14px] font-bold text-on-primary">
              {t.balance.goToOrder}
            </Link>
          </div>
        )}
      </AppShell>
    );
  }
  // Without the card cycles not settled yet (lib/payments/balance-due.ts).
  const balance = await getWalletBalance(getDb(), memberId, member?.paysOffline ?? false);
  const online = settings.onlineTopupAvailable && !payPerOrder;
  const bank = settings.bankTransfer;
  // The group's maximum balance, in cents: online top-ups stop there, the
  // bank section says how much still fits.
  const balanceCents = Math.round(balance * 100);
  const maxBalanceCents = settings.maxBalance === null ? null : Math.round(settings.maxBalance * 100);
  const ceilingCents = topupCeilingCents(balanceCents, maxBalanceCents);
  const roomCents = maxBalanceCents === null ? null : maxBalanceCents - balanceCents;

  return (
    <AppShell email={session.user.email} name={session.user.fullName} isAdmin={role === "admin"} memberId={memberId} personId={session.user.personId}>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-[22px] font-black tracking-[-0.02em] text-brand-near-black">{t.topup.title}</h1>
        <HelpLink href="/guida/soldi" />
      </div>

      {result && (
        <div className={`mb-4 rounded-[14px] border p-[12px_14px] text-[14px] ${TONE_CLASSES[result.tone]}`}>
          {result.text}
          {result.pending && <PendingRefresh />}
        </div>
      )}

      <div
        className={`mb-4 rounded-[16px] border p-4 ${
          balance < 0 ? "border-brand-red/30 bg-brand-red-light" : "border-primary-mid bg-primary-soft"
        }`}
      >
        <div
          className={`mb-[6px] font-mono text-label uppercase tracking-[0.10em] ${
            balance < 0 ? "text-brand-red" : "text-primary-text"
          }`}
        >
          {t.topup.currentBalance}
        </div>
        <span
          className={`text-[36px] font-black tracking-[-0.04em] ${
            balance < 0 ? "text-brand-red" : "text-brand-near-black"
          }`}
        >
          {formatMoney(Math.abs(balance))}
        </span>
      </div>

      {online && (
        <section className="mb-4 rounded-card border border-brand-border bg-white p-[18px] shadow-card">
          <h2 className="mb-1 text-[16px] font-extrabold text-brand-near-black">{t.topup.onlineTitle}</h2>
          {ceilingCents === null ? (
            // Only a maximum can leave nothing for Stripe (topupCeilingCents).
            <p className="text-[14px] text-brand-gray">
              {maxBalanceCents !== null &&
              roomCents !== null &&
              topupBlockReason(balanceCents, maxBalanceCents) === "belowMinimum"
                ? t.topup.belowOnlineMinimum(formatMoney(roomCents / 100))
                : t.topup.atMaximum}
            </p>
          ) : (
            <>
              <p className="mb-4 text-[14px] text-brand-gray">{t.topup.onlineHint}</p>
              <TopupForm
                presets={topupPresets(balanceCents, ceilingCents)}
                minCents={TOPUP_MIN_CENTS}
                maxCents={ceilingCents}
              />
            </>
          )}
        </section>
      )}

      {/* Bank details when that channel is on; the "ask the treasurer" line
          only when members have no channel at all. */}
      {(bank || !online) && (
        <section className="mb-4 rounded-card border border-brand-border bg-white p-[18px] shadow-card">
          <h2 className="mb-1 text-[16px] font-extrabold text-brand-near-black">{t.topup.bankTitle}</h2>
          {bank ? (
            <>
              <p className="mb-3 text-[14px] text-brand-gray">{t.topup.bankHint}</p>
              {roomCents !== null && (
                <p className="mb-3 text-[14px] font-semibold text-brand-near-black">
                  {roomCents > 0 ? t.topup.bankRoom(formatMoney(roomCents / 100)) : t.topup.atMaximum}
                </p>
              )}
              <CopyField label={t.topup.bankHolder} value={bank.holder} />
              <CopyField label={t.topup.bankIban} value={compactIban(bank.iban)} display={formatIban(bank.iban)} mono />
              <CopyField
                label={t.topup.bankReference}
                value={t.topup.bankReferenceValue(member?.fullName ?? session.user.fullName ?? session.user.email)}
              />
            </>
          ) : (
            <p className="text-[14px] text-brand-gray">{t.topup.bankUnavailable}</p>
          )}
        </section>
      )}
    </AppShell>
  );
}

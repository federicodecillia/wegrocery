import { and, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { CopyField } from "@/components/ricarica/copy-field";
import { PendingRefresh } from "@/components/ricarica/pending-refresh";
import { TopupForm } from "@/components/ricarica/topup-form";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import { brand } from "@/lib/brand";
import { getDb } from "@/lib/db/client";
import { getMemberBalance } from "@/lib/db/queries";
import { payments } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { TOPUP_MAX_CENTS, TOPUP_MIN_CENTS, TOPUP_PRESETS_CENTS } from "@/lib/payments/config";
import { isOnlineTopupEnabled } from "@/lib/payments/stripe";

type Result = { tone: "ok" | "info" | "error"; text: string; pending?: boolean } | null;

// The success redirect only says "come back and look": what the member sees is
// the payment row, which only the signed webhook moves to succeeded.
async function resultFor(memberId: string, esito?: string, sessionId?: string): Promise<Result> {
  if (esito === "annullato") return { tone: "info", text: t.topup.resultCancelled };
  if (esito !== "ok" || !sessionId) return null;
  const [payment] = await getDb()
    .select({ status: payments.status, amountCents: payments.amountCents })
    .from(payments)
    .where(and(eq(payments.checkoutSessionId, sessionId), eq(payments.memberId, memberId)))
    .limit(1);
  if (!payment) return null;
  if (payment.status === "pending") return { tone: "info", text: t.topup.resultPending, pending: true };
  if (payment.status === "failed" || payment.status === "expired") {
    return { tone: "error", text: t.topup.resultFailed };
  }
  return { tone: "ok", text: t.topup.resultCredited(formatMoney(payment.amountCents / 100)) };
}

const TONE_CLASSES = {
  ok: "border-brand-teal bg-brand-teal-light text-brand-near-black",
  info: "border-brand-orange-mid bg-brand-orange-light text-brand-near-black",
  error: "border-[#f9c8c8] bg-brand-red-light text-brand-red",
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

  const [balance, result] = await Promise.all([
    getMemberBalance(memberId),
    resultFor(memberId, esito, session_id),
  ]);
  const onlineEnabled = isOnlineTopupEnabled();
  const bank = brand.bankTransfer;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"} memberId={memberId}>
      <h1 className="mb-4 text-[22px] font-black tracking-[-0.02em] text-brand-near-black">{t.topup.title}</h1>

      {result && (
        <div className={`mb-4 rounded-[14px] border p-[12px_14px] text-[14px] ${TONE_CLASSES[result.tone]}`}>
          {result.text}
          {result.pending && <PendingRefresh />}
        </div>
      )}

      <div
        className={`mb-4 rounded-[16px] border p-4 ${
          balance < 0 ? "border-[#f9c8c8] bg-brand-red-light" : "border-brand-orange-mid bg-brand-orange-light"
        }`}
      >
        <div
          className={`mb-[6px] font-mono text-[10px] uppercase tracking-[0.10em] ${
            balance < 0 ? "text-brand-red" : "text-brand-orange"
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

      {onlineEnabled && (
        <section className="mb-4 rounded-[18px] border border-brand-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-1 text-[16px] font-extrabold text-brand-near-black">{t.topup.onlineTitle}</h2>
          <p className="mb-4 text-[13px] text-brand-gray">{t.topup.onlineHint}</p>
          <TopupForm
            presetsCents={[...TOPUP_PRESETS_CENTS]}
            minCents={TOPUP_MIN_CENTS}
            maxCents={TOPUP_MAX_CENTS}
          />
        </section>
      )}

      <section className="mb-4 rounded-[18px] border border-brand-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-1 text-[16px] font-extrabold text-brand-near-black">{t.topup.bankTitle}</h2>
        {bank ? (
          <>
            <p className="mb-3 text-[13px] text-brand-gray">{t.topup.bankHint}</p>
            <CopyField label={t.topup.bankHolder} value={bank.holder} />
            <CopyField label={t.topup.bankIban} value={bank.iban} mono />
            <CopyField
              label={t.topup.bankReference}
              value={t.topup.bankReferenceValue(session.user.fullName ?? session.user.email)}
            />
          </>
        ) : (
          <p className="text-[13px] text-brand-gray">{t.topup.bankUnavailable}</p>
        )}
      </section>
    </AppShell>
  );
}

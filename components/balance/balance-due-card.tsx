import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/i18n/format";
import { SETTLEMENT_MIN_DUE_CENTS } from "@/lib/payments/settlement";
import { PayBalanceButton } from "./pay-balance-button";

// Pay-per-order: the consolidated balance (lib/payments/balance-due.ts) as an
// amount due with "Paga ora", or a credit the association gives back.
// Nothing when it is within the payment minimum of zero.
export function BalanceDueCard({ cents, canPay }: { cents: number; canPay: boolean }) {
  if (cents <= -SETTLEMENT_MIN_DUE_CENTS) {
    const amount = formatMoney(-cents / 100);
    return (
      <div className="mb-[14px] rounded-card border-[1.5px] border-brand-red/30 bg-brand-red-light p-4">
        <div className="mb-[6px] font-mono text-label font-semibold uppercase tracking-[0.13em] text-brand-red">
          {t.balance.dueLabel}
        </div>
        <div className="mb-[6px] text-[32px] font-black leading-none tracking-[-0.04em] text-brand-red">{amount}</div>
        <p className="mb-[12px] text-[14px] text-brand-near-black">{t.balance.dueHint}</p>
        {canPay ? <PayBalanceButton amountLabel={amount} /> : <p className="text-[14px] text-brand-gray">{t.order.pay.unavailable}</p>}
      </div>
    );
  }
  if (cents > 0) {
    return (
      <div className="mb-[14px] rounded-card border-[1.5px] border-primary-mid bg-primary-soft p-4">
        <div className="mb-[6px] font-mono text-label font-semibold uppercase tracking-[0.13em] text-primary-text">
          {t.balance.creditLabel}
        </div>
        <div className="mb-[6px] text-[32px] font-black leading-none tracking-[-0.04em] text-brand-near-black">
          {formatMoney(cents / 100)}
        </div>
        <p className="text-[14px] text-brand-near-black">{t.balance.creditHint}</p>
      </div>
    );
  }
  return null;
}

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
      <div className="mb-3.5 rounded-card border-[1.5px] border-destructive/30 bg-danger-bg p-4">
        <div className="mb-1.5 font-mono text-label font-semibold uppercase tracking-[0.13em] text-destructive">
          {t.balance.dueLabel}
        </div>
        <div className="mb-1.5 text-[32px] font-black leading-none tracking-[-0.04em] text-destructive">{amount}</div>
        <p className="mb-3 text-[14px] text-foreground">{t.balance.dueHint}</p>
        {canPay ? <PayBalanceButton amountLabel={amount} /> : <p className="text-[14px] text-secondary-foreground">{t.order.pay.unavailable}</p>}
      </div>
    );
  }
  if (cents > 0) {
    return (
      <div className="mb-3.5 rounded-card border-[1.5px] border-primary-mid bg-primary-bg p-4">
        <div className="mb-1.5 font-mono text-label font-semibold uppercase tracking-[0.13em] text-primary-text">
          {t.balance.creditLabel}
        </div>
        <div className="mb-1.5 text-[32px] font-black leading-none tracking-[-0.04em] text-foreground">
          {formatMoney(cents / 100)}
        </div>
        <p className="text-[14px] text-foreground">{t.balance.creditHint}</p>
      </div>
    );
  }
  return null;
}

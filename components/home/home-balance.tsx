import Link from "next/link";
import { t } from "@/lib/i18n";
import { formatSignedMoney } from "@/lib/i18n/format";

// Home → Saldo e movimenti: the wallet balance on one line. With orders paid
// by card it stays near zero, so it is no longer the page's hero; red, with
// a "Ricarica" button, only when it is negative.
export function HomeBalance({
  balance,
  afterOrders,
  feeIncluded,
  topups,
  cardSettlesWallet,
  supportEmail,
}: {
  balance: number;
  /** The balance once the open wallet orders are charged; null without such orders. */
  afterOrders: number | null;
  /** The estimate includes an order preparation fee. */
  feeIncluded: boolean;
  /** Members may top up (a wallet group can switch it off). */
  topups: boolean;
  cardSettlesWallet: boolean;
  supportEmail: string;
}) {
  const negative = balance < 0;
  return (
    <div className={`mb-3 rounded-card border px-4 py-3 shadow-card ${negative ? "border-destructive/30 bg-danger-bg" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[14px] font-semibold ${negative ? "text-destructive" : "text-secondary-foreground"}`}>
            {negative ? t.home.balanceToTopUp : t.home.balanceShort}
          </div>
          <div className={`text-[20px] font-black tabular-nums tracking-[-0.03em] ${negative ? "text-destructive" : "text-foreground"}`}>
            {formatSignedMoney(balance)}
          </div>
        </div>
        {topups &&
          (negative ? (
            <Link href="/ricarica" className="flex min-h-11 shrink-0 items-center rounded-full bg-danger px-4 text-[14px] font-bold text-danger-foreground">
              {t.home.rechargeLink}
            </Link>
          ) : (
            <Link href="/ricarica" className="flex min-h-11 shrink-0 items-center text-[14px] font-bold text-primary-text">
              {t.home.rechargeLink} <span aria-hidden className="ml-1">→</span>
            </Link>
          ))}
      </div>
      {/* Worth a line only when the open orders take the balance below zero: then it is news. */}
      {afterOrders !== null && afterOrders < 0 && (
        <p className="mt-2 rounded-lg bg-warning-bg px-3 py-2 text-[14px] text-warning">
          <span className="tabular-nums font-semibold">{t.home.afterOpenOrdersShort(formatSignedMoney(afterOrders))}</span>
          {feeIncluded && <span className="block text-[13px]">{t.home.feeIncluded}</span>}
        </p>
      )}
      {!topups && negative && (
        <p className="mt-2 text-[13px] text-secondary-foreground">
          {cardSettlesWallet ? (
            t.home.topupsOffDebtCard
          ) : (
            <>
              {t.home.topupsOffDebtContact}{" "}
              <a href={`mailto:${supportEmail}`} className="break-all font-semibold text-primary-text underline">
                {supportEmail}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}

import { formatSignedMoney } from "@/lib/i18n/format";

// The balance card of Storico (Movimenti) and Ricarica: the same signed
// amount Home shows ("+85,00 €", "-12,40 €"), red when in debt.
export function BalanceSummary({ label, balance, className = "mb-4" }: { label: string; balance: number; className?: string }) {
  const negative = balance < 0;
  return (
    <div
      className={`rounded-card border p-4 ${
        negative ? "border-destructive/30 bg-danger-bg" : "border-primary-mid bg-primary-bg"
      } ${className}`}
    >
      <div
        className={`mb-1.5 font-mono text-label uppercase tracking-[0.10em] ${
          negative ? "text-destructive" : "text-primary-text"
        }`}
      >
        {label}
      </div>
      <span
        className={`whitespace-nowrap text-[36px] font-black tabular-nums tracking-[-0.04em] ${
          negative ? "text-destructive" : "text-foreground"
        }`}
      >
        {formatSignedMoney(balance)}
      </span>
    </div>
  );
}

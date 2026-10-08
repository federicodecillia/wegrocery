import { formatSignedMoney } from "@/lib/i18n/format";

// The balance card of Storico (Movimenti) and Ricarica: the same signed
// amount Home shows ("+85,00 €", "-12,40 €"), red when in debt.
export function BalanceSummary({ label, balance, className = "mb-4" }: { label: string; balance: number; className?: string }) {
  const negative = balance < 0;
  return (
    <div
      className={`rounded-card border p-4 ${
        negative ? "border-brand-red/30 bg-brand-red-light" : "border-primary-mid bg-primary-soft"
      } ${className}`}
    >
      <div
        className={`mb-[6px] font-mono text-label uppercase tracking-[0.10em] ${
          negative ? "text-brand-red" : "text-primary-text"
        }`}
      >
        {label}
      </div>
      <span
        className={`whitespace-nowrap text-[36px] font-black tracking-[-0.04em] ${
          negative ? "text-brand-red" : "text-brand-near-black"
        }`}
      >
        {formatSignedMoney(balance)}
      </span>
    </div>
  );
}

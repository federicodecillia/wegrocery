import { t } from "@/lib/i18n";

// "Send the receipt to …": the address opens a new email whose subject is the
// order's reference, so whoever keeps the books can match the two.
export function BankReceipt({ email, subject }: { email: string; subject?: string }) {
  const href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <p className="mt-3 text-[14px] text-brand-gray">
      {t.topup.bankReceipt}{" "}
      <a href={href} className="break-words font-semibold text-primary-text underline underline-offset-2">
        {email}
      </a>
    </p>
  );
}

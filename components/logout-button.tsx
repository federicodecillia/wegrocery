"use client";

import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { confirm } from "@/components/ui/confirm-dialog";

type Props = {
  action: () => Promise<void>;
};

// The last row of the Profile page (app/profilo), away from the header's
// bell so it is not tapped by mistake; asks before signing out.
export function LogoutButton({ action }: Props) {
  async function handleClick() {
    const ok = await confirm({
      title: t.logout.confirmTitle,
      message: t.logout.confirmMessage(brand.appName),
      confirmLabel: t.logout.confirmButton,
      cancelLabel: t.common.cancel,
    });
    if (ok) await action();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-[52px] w-full items-center rounded-card border border-brand-border bg-white px-4 py-[12px] text-left text-[14px] font-bold text-brand-red shadow-card transition-colors hover:bg-brand-red-light"
    >
      {t.logout.confirmButton}
    </button>
  );
}

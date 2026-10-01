import type { Strings } from "@/lib/i18n";
import { type LedgerMovement, type MovementKind, movementKind } from "@/lib/movement-label";

// The type badge of a ledger row in admin Cassa. One mapping over
// movementKind (the member-facing label logic), so a type the member views
// know is never shown to the admin as its raw code; anything unknown gets the
// generic "movement" badge.

type TreasuryLabels = Strings["admin"]["treasury"];

const badgeTeal = "bg-accent-soft text-accent-text";
const badgeRed = "bg-brand-red-light text-brand-red";
const badgeOrange = "bg-primary-soft text-brand-near-black";
const badgeGray = "bg-black/[0.05] text-brand-gray";

export function ledgerBadge(entry: LedgerMovement, tr: TreasuryLabels): { label: string; className: string } {
  const byKind: Record<MovementKind, { label: string; className: string }> = {
    topup: { label: tr.topupBadge, className: badgeTeal },
    online_topup: { label: tr.topupBadge, className: badgeTeal },
    order: { label: tr.chargeBadge, className: badgeRed },
    shipping: { label: tr.shippingBadge, className: badgeRed },
    handling: { label: tr.handlingBadge, className: badgeRed },
    refund: { label: tr.refundBadge, className: badgeTeal },
    online_refund: { label: tr.cardRefundBadge, className: badgeOrange },
    refund_failed: { label: tr.refundFailedBadge, className: badgeTeal },
    order_payment: { label: tr.orderPaymentBadge, className: badgeTeal },
    order_refund: { label: tr.cardRefundBadge, className: badgeOrange },
    balance_payment: { label: tr.balancePaymentBadge, className: badgeTeal },
    reversal: { label: tr.reversalBadge, className: badgeGray },
    adjustment: { label: tr.correctionBadge, className: badgeGray },
    payout: { label: tr.payoutBadge, className: badgeOrange },
    manual_charge: { label: tr.manualChargeBadge, className: badgeRed },
    membership_fee: { label: tr.membershipFeeBadge, className: badgeRed },
    other: { label: tr.otherBadge, className: badgeGray },
  };
  return byKind[movementKind(entry)];
}

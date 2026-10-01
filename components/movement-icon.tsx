import type { ReactNode } from "react";
import type { MovementKind } from "@/lib/movement-label";

// One icon per kind of ledger movement (Storico "Movimenti"); the tile is teal
// for money coming in and orange for money going out. Stroke icons in the
// Feather style of the rest of the app, 24x24 viewBox.
const PATHS: Record<MovementKind, ReactNode> = {
  // Bank transfer or cash top-up: arrow up.
  topup: (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  ),
  // Online top-up: card.
  online_topup: (
    <>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  // Order: cart.
  order: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </>
  ),
  // Shipping: van.
  shipping: (
    <>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  // Order preparation fee: same mark as a charge.
  handling: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  // Refund: arrow turning back.
  refund: (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  // Stripe refund of an online top-up: card with an arrow going back.
  online_refund: (
    <>
      <rect x="1" y="5" width="15" height="12" rx="2" />
      <line x1="1" y1="9.5" x2="16" y2="9.5" />
      <line x1="23" y1="15" x2="17" y2="15" />
      <polyline points="20 12 17 15 20 18" />
    </>
  ),
  // Card refund Stripe could not pay: alert.
  refund_failed: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  // Order paid by card: a card.
  order_payment: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </>
  ),
  // Money going back to the card: a card with an arrow back.
  order_refund: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <polyline points="9 12 6 15 9 18" />
      <line x1="6" y1="15" x2="16" y2="15" />
    </>
  ),
  // Amount due paid by card: a card with a check.
  balance_payment: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <polyline points="8 12 11 15 16 10" />
    </>
  ),
  // Reversal: a turning arrow.
  reversal: <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />,
  // Adjustment: pencil.
  adjustment: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  // Balance returned to the member: arrow leaving a box.
  payout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  // Manual charge: receipt.
  manual_charge: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  // Membership fee: membership card.
  membership_fee: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <path d="M5 16c.6-1.5 1.8-2.2 3-2.2s2.4.7 3 2.2" />
      <line x1="14" y1="10" x2="18" y2="10" />
      <line x1="14" y1="14" x2="18" y2="14" />
    </>
  ),
  // Anything else: dots.
  other: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
};

export function MovementIcon({ kind, incoming }: { kind: MovementKind; incoming: boolean }) {
  return (
    <div
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${
        incoming ? "bg-accent-soft text-accent-text" : "bg-primary-soft text-primary-text"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[kind]}
      </svg>
    </div>
  );
}

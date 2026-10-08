"use client";

import { confirm } from "@/components/ui/confirm-dialog";
import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { formatDeadline, formatPickupSlot } from "@/lib/i18n/deadline";
import { t } from "@/lib/i18n";
import { formatMoney, formatHandlingFee } from "@/lib/i18n/format";
import { HANDLING_FEE_MAX, cycleHandlingFee } from "@/lib/payments/order-payment";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";
import {
  adminCreateCycle,
  adminUpdateCycle,
  type CreateCycleInput,
} from "@/lib/actions/admin";
import { formatEur } from "@/lib/utils";
import { ACCESS_LEVELS, DEFAULT_ACCESS_LEVEL, getAccessLabel, normalizeAccessLevel } from "@/lib/roles";
import { Card, CardBody } from "@/components/ui/card";
import type { CatalogProductItem } from "@/lib/db/queries";
import Link from "next/link";
import { adminHref } from "@/lib/admin/nav";
import { CycleReviewCloseButton } from "./cycle-review-modal";
import { SupplierActionsDialog } from "./supplier-actions-dialog";
import { ImportListingWizard } from "./import-listing-wizard";

type Supplier = { supplierId: string; name: string };

export type SerializedCycle = {
  cycleId: string;
  title: string;
  orderCloseAt: string | null;
  pickupDate: string | null;
  pickupEndTime: string | null;
  pickup2Date: string | null;
  pickup2EndTime: string | null;
  notes: string | null;
  supplierId: string | null;
  accessLevel: string;
  isOverdue: boolean;
  shippingMode: string;
  shippingCostPerMember: string | null;
  shippingTotal: string | null;
  status?: string;
  // Pay-per-order cycles only.
  paymentMode?: string;
  handlingFeeType?: string | null;
  handlingFeeValue?: string | null;
};

function AccessLevelOptions() {
  return ACCESS_LEVELS.map((level) => (
    <option key={level} value={level}>
      {t.cycleAccess[level]}
    </option>
  ));
}

// ── Cycle workspace pieces (Admin → Ciclo, cycle-workspace.tsx) ──────────────

export type CycleStats = { orderCount: number; grandTotal: number; unpaidDrafts?: number; pendingPayments?: number };

// What to say before closing: unpaid card drafts, and the fee (a typo shows
// here, not on the charges).
function closeWarnings(cycle: SerializedCycle, stats: CycleStats) {
  const perOrderWarning =
    cycle.paymentMode === "per_order" && ((stats.unpaidDrafts ?? 0) > 0 || (stats.pendingPayments ?? 0) > 0)
      ? t.admin.cycle.perOrderCloseWarning(stats.unpaidDrafts ?? 0, stats.pendingPayments ?? 0)
      : null;
  const fee = cycleHandlingFee({
    handlingFeeType: cycle.handlingFeeType ?? null,
    handlingFeeValue: cycle.handlingFeeValue ?? null,
  });
  const closeWarning =
    [perOrderWarning, fee ? t.admin.cycle.closeFeeNote(formatHandlingFee(fee)) : null].filter(Boolean).join("\n\n") ||
    null;
  return { perOrderWarning, closeWarning };
}

/** The open cycle's main action, in the workspace header. */
export function CloseCycleAction({ cycle, stats }: { cycle: SerializedCycle; stats: CycleStats }) {
  return (
    <CycleReviewCloseButton
      cycleId={cycle.cycleId}
      cycleTitle={cycle.title}
      memberCount={stats.orderCount}
      perOrder={cycle.paymentMode === "per_order"}
      warning={closeWarnings(cycle, stats).closeWarning}
    />
  );
}

/** Deadline, pickups, shipping and access: the facts of a cycle, read-only. */
export function CycleFacts({ cycle }: { cycle: SerializedCycle }) {
  return (
    <div className="space-y-1 text-[13px] text-brand-gray">
      {cycle.orderCloseAt && (
        <div>
          {t.admin.cycle.orderCloseAt}:{" "}
          <span className="font-semibold text-brand-near-black">{formatDeadline(cycle.orderCloseAt)}</span>
        </div>
      )}
      {cycle.pickupDate && (
        <div>
          {cycle.pickup2Date ? t.admin.cycle.pickupFirst : t.admin.cycle.pickupSingle}{" "}
          <span className="font-semibold text-brand-near-black">
            {formatPickupSlot(cycle.pickupDate, cycle.pickupEndTime ?? null)}
          </span>
        </div>
      )}
      {cycle.pickup2Date && (
        <div>
          {t.admin.cycle.pickupSecond}{" "}
          <span className="font-semibold text-brand-near-black">
            {formatPickupSlot(cycle.pickup2Date, cycle.pickup2EndTime ?? null)}
          </span>
        </div>
      )}
      {cycle.shippingMode === "proportional" && cycle.shippingTotal && parseFloat(cycle.shippingTotal) > 0 && (
        <div>
          {t.admin.cycle.shippingLabel}:{" "}
          <span className="font-semibold text-brand-near-black">
            {t.admin.cycle.shippingProportionalDisplay(formatMoney(cycle.shippingTotal))}
          </span>
        </div>
      )}
      {cycle.shippingMode !== "proportional" &&
        cycle.shippingCostPerMember &&
        parseFloat(cycle.shippingCostPerMember) > 0 && (
          <div>
            {t.admin.cycle.shippingLabel}:{" "}
            <span className="font-semibold text-brand-near-black">
              {t.admin.cycle.shippingPerMemberDisplay(formatMoney(cycle.shippingCostPerMember))}
            </span>
          </div>
        )}
      <div>
        {t.admin.cycle.accessLabel}:{" "}
        <span className="font-semibold text-brand-near-black">{getAccessLabel(cycle.accessLevel)}</span>
      </div>
    </div>
  );
}

/** Panoramica of an open cycle: how many ordered, the total, what to know before closing. */
export function OpenCycleOverview({ cycle, stats }: { cycle: SerializedCycle; stats: CycleStats }) {
  const { perOrderWarning } = closeWarnings(cycle, stats);
  return (
    <Card>
      <CardBody>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-primary-soft px-3 py-2">
            <div className="text-label text-brand-gray">{t.admin.cycle.ordersCount}</div>
            <div className="text-[20px] font-bold text-brand-near-black">{stats.orderCount}</div>
          </div>
          <div className="rounded-lg bg-accent-soft px-3 py-2">
            <div className="text-label text-brand-gray">{t.admin.cycle.totalAmount}</div>
            <div className="text-[20px] font-bold tabular-nums text-brand-near-black">{formatEur(stats.grandTotal)}</div>
          </div>
        </div>
        {perOrderWarning && (
          <div className="mt-3 rounded-lg border border-primary-mid bg-primary-soft p-3 text-[13px] text-brand-near-black">
            {perOrderWarning}
          </div>
        )}
        {cycle.isOverdue && (
          <div className="mt-3 rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-[13px] text-brand-red">
            {t.admin.cycle.overdueWarning}
          </div>
        )}
        <div className="mt-3">
          <CycleFacts cycle={cycle} />
        </div>
        <div className="mt-3">
          <OrdersLink cycleId={cycle.cycleId} />
        </div>
      </CardBody>
    </Card>
  );
}

/** Prodotti of an open cycle: import a price list, add from the catalogue, edit what is there. */
export function CycleProductsView({ cycle, suppliers }: { cycle: SerializedCycle; suppliers: Supplier[] }) {
  const [importing, setImporting] = useState(false);
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-prose text-[13px] text-brand-gray">{t.admin.workspace.productsIntro}</p>
          <button
            onClick={() => setImporting(true)}
            className="min-h-10 rounded-xl border border-primary/30 bg-primary-soft px-3 text-[13px] font-bold text-primary-text"
          >
            {t.admin.cycle.importListing}
          </button>
        </div>
        <div className="mt-4 border-t border-brand-border pt-4">
          <CycleProductPicker cycleId={cycle.cycleId} suppliers={suppliers} />
        </div>
      </CardBody>
      <ImportListingWizard
        open={importing}
        onClose={() => setImporting(false)}
        cycleId={cycle.cycleId}
        cycleTitle={cycle.title}
      />
    </Card>
  );
}

// ── Edit Cycle Form ───────────────────────────────────────────────────────────

// Wall-clock value in APP_TIME_ZONE; the server action converts it to UTC.
function buildDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

const inputCls = "rounded-lg border border-brand-border px-2 py-2 text-[13px] text-brand-near-black";
const labelCls = "mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray";
const miniLabelCls = "shrink-0 text-label font-medium text-brand-gray";

// 15-minute time slots from 06:00 to 22:00. A <select> of these replaces the
// native <input type="time">: it is unambiguous on mobile and cannot produce an
// "invalid" value when an admin types e.g. "19.30" with an Italian-style dot.
const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let m = 6 * 60; m <= 22 * 60; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
})();

// A single time-slot dropdown. Keeps a legacy off-grid value (e.g. an old
// "19:10") selectable by prepending it, so editing never silently resets it.
function TimeSlotSelect({ name, defValue, ariaLabel }: { name: string; defValue?: string; ariaLabel: string }) {
  const options = defValue && !TIME_SLOTS.includes(defValue) ? [defValue, ...TIME_SLOTS] : TIME_SLOTS;
  return (
    <select name={name} defaultValue={defValue ?? ""} aria-label={ariaLabel} className={`min-w-0 flex-1 ${inputCls}`}>
      <option value="">—</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

// One pickup row (label + date + "Dalle/Alle" time range). The time range is a
// single flex child with a min-width so it wraps onto its own line as a unit on
// narrow screens instead of pushing the inputs past the viewport edge.
function PickupRow({
  label,
  prefix,
  defDate,
  defStart,
  defEnd,
}: {
  label: string;
  prefix: "pickup" | "pickup2";
  defDate?: string;
  defStart?: string;
  defEnd?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-[46px] shrink-0 text-[12px] font-semibold text-brand-near-black">{label}</span>
      <input
        name={`${prefix}DateOnly`}
        type="date"
        aria-label={label}
        defaultValue={defDate}
        className={`w-[140px] shrink-0 ${inputCls}`}
      />
      <div className="flex min-w-[190px] flex-1 items-center gap-1.5">
        <span className={miniLabelCls}>{t.admin.cycle.timeFrom}</span>
        <TimeSlotSelect name={`${prefix}StartTime`} defValue={defStart} ariaLabel={`${label}, ${t.admin.cycle.timeFrom}`} />
        <span className={miniLabelCls}>{t.admin.cycle.timeTo}</span>
        <TimeSlotSelect name={`${prefix}EndTime`} defValue={defEnd} ariaLabel={`${label}, ${t.admin.cycle.timeTo}`} />
      </div>
    </div>
  );
}

// Pickup section shared by create + edit forms. The first pickup is always
// shown; the second is hidden behind a toggle so the admin is never confronted
// with empty Ritiro 2 fields. When hidden, its inputs are not rendered, so the
// FormData carries no pickup2 values → the server stores NULL (and the edit
// patch, which always includes the pickup2 keys, clears a previously-saved one).
function PickupSection({
  defPickup1Date,
  defPickup1Start,
  defPickup1End,
  defPickup2Date,
  defPickup2Start,
  defPickup2End,
}: {
  defPickup1Date?: string;
  defPickup1Start?: string;
  defPickup1End?: string;
  defPickup2Date?: string;
  defPickup2Start?: string;
  defPickup2End?: string;
}) {
  const [showPickup2, setShowPickup2] = useState(Boolean(defPickup2Date));
  return (
    <div>
      <p className={labelCls}>{t.admin.cycle.pickupSection}</p>
      <div className="space-y-2">
        <PickupRow
          label={t.admin.cycle.pickup1Label}
          prefix="pickup"
          defDate={defPickup1Date}
          defStart={defPickup1Start}
          defEnd={defPickup1End}
        />
        {showPickup2 ? (
          <>
            <PickupRow
              label={t.admin.cycle.pickup2Label}
              prefix="pickup2"
              defDate={defPickup2Date}
              defStart={defPickup2Start}
              defEnd={defPickup2End}
            />
            <button
              type="button"
              onClick={() => setShowPickup2(false)}
              className="text-label font-semibold text-brand-gray hover:text-brand-red"
            >
              {t.admin.cycle.removePickup2}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowPickup2(true)}
            className="text-[12px] font-semibold text-primary-text hover:underline"
          >
            {t.admin.cycle.addPickup2}
          </button>
        )}
      </div>
    </div>
  );
}

// Shared shipping section: a segmented switch between flat per-member fee
// and proportional split, with the relevant input rendered below.
function ShippingModeFields({
  mode,
  onModeChange,
  defaultPerMember,
  defaultTotal,
}: {
  mode: "fixed_per_member" | "proportional";
  onModeChange: (mode: "fixed_per_member" | "proportional") => void;
  defaultPerMember: string;
  defaultTotal: string;
}) {
  return (
    <div>
      <p className={labelCls}>{t.admin.cycle.shippingLabel}</p>
      <div className="mb-2 flex rounded-lg bg-black/[0.05] p-0.5">
        {(
          [
            { v: "fixed_per_member", label: t.admin.cycle.shippingFixed },
            { v: "proportional", label: t.admin.cycle.shippingProportional },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onModeChange(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-label font-semibold transition-colors ${
              mode === opt.v
                ? "bg-white text-brand-near-black shadow-sm"
                : "bg-transparent text-brand-gray"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === "fixed_per_member" ? (
        <div>
          <input
            name="shippingCostPerMember"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultPerMember}
            placeholder="0.00"
            className={`w-full ${inputCls}`}
          />
          <p className="mt-1 text-label text-muted">
            {t.admin.cycle.shippingFixedHint}
          </p>
          {/* Hidden so the form data shape stays uniform across modes. */}
          <input type="hidden" name="shippingTotal" value="" />
        </div>
      ) : (
        <div>
          <input
            name="shippingTotal"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultTotal}
            placeholder="0.00"
            className={`w-full ${inputCls}`}
          />
          <p className="mt-1 text-label text-muted">
            {t.admin.cycle.shippingProportionalHint}
          </p>
          <input type="hidden" name="shippingCostPerMember" value="" />
        </div>
      )}
    </div>
  );
}

type FeeChoice = "none" | "percent" | "fixed";

// The order preparation fee of a cycle: a percentage of the products, a fixed
// amount per member, or (wallet cycles only) none.
function HandlingFeeFields({
  defaultType,
  defaultValue,
  allowNone,
  warning,
  note,
}: {
  defaultType: FeeChoice;
  defaultValue: string;
  allowNone: boolean;
  warning?: string;
  note?: string | null;
}) {
  const [type, setType] = useState<FeeChoice>(defaultType);
  const options: { v: FeeChoice; label: string }[] = [
    ...(allowNone ? [{ v: "none" as const, label: t.admin.cycle.handlingFeeNone }] : []),
    { v: "percent", label: t.admin.cycle.handlingFeePercent },
    { v: "fixed", label: t.admin.cycle.handlingFeeFixed },
  ];
  return (
    <div>
      <p className={labelCls}>{t.admin.cycle.handlingFeeLabel}</p>
      <div className="mb-2 flex rounded-lg bg-black/[0.05] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setType(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-label font-semibold transition-colors ${
              type === opt.v ? "bg-white text-brand-near-black shadow-sm" : "bg-transparent text-brand-gray"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="handlingFeeType" value={type} />
      {type === "none" ? (
        <input type="hidden" name="handlingFeeValue" value="" />
      ) : (
        <input
          name="handlingFeeValue"
          type="number"
          min="0"
          max={String(HANDLING_FEE_MAX[type])}
          step="0.01"
          required
          defaultValue={defaultValue}
          className={`w-full ${inputCls}`}
        />
      )}
      <p className="mt-1 text-label text-muted">{t.admin.cycle.handlingFeeHint}</p>
      {note && <p className="mt-1 text-label text-brand-gray">{note}</p>}
      {warning && <p className="mt-1 text-label text-brand-red">{warning}</p>}
    </div>
  );
}

export function EditCycleForm({
  cycle,
  suppliers,
  onClose,
  isClosed = false,
}: {
  cycle: SerializedCycle;
  suppliers: Supplier[];
  onClose: () => void;
  isClosed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isPerOrder = cycle.paymentMode === "per_order";
  const cycleFee = cycleHandlingFee(cycle);
  // Prefill in app-zone wall time: slicing the ISO string would show UTC.
  const closeAtLocal = utcToZonedLocalInput(cycle.orderCloseAt);
  const pickupLocal = utcToZonedLocalInput(cycle.pickupDate);
  const pickup2Local = utcToZonedLocalInput(cycle.pickup2Date);
  // "manual" means the cycle is being driven by a supplier-distinta import:
  // shipping_charge ledger entries are per-member and the recompute is
  // suppressed (see adminUpdateCycle / recomputeShippingForClosedCycle).
  // The toggle is hidden in that mode — the admin sees a banner instead.
  const [shippingMode, setShippingMode] = useState<
    "fixed_per_member" | "proportional" | "manual"
  >(
    cycle.shippingMode === "proportional"
      ? "proportional"
      : cycle.shippingMode === "manual"
      ? "manual"
      : "fixed_per_member",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // On a closed cycle we deliberately skip fields that don't make sense to
    // change post-closure (orderCloseAt, accessLevel). Those inputs are also
    // disabled visually so the user doesn't expect them to apply. supplierId
    // stays editable after closure — a cycle can be closed before the supplier
    // was ever set, and that's the one field the admin still needs to fix
    // (it gates the "Fornitore" send/import actions on the closed cycle).
    const basePatch = {
      title: fd.get("title") as string,
      pickupDate: buildDateTime(fd.get("pickupDateOnly") as string, fd.get("pickupStartTime") as string),
      pickupEndTime: fd.get("pickupEndTime") as string,
      pickup2Date: buildDateTime(fd.get("pickup2DateOnly") as string, fd.get("pickup2StartTime") as string),
      pickup2EndTime: fd.get("pickup2EndTime") as string,
      notes: fd.get("notes") as string,
      supplierId: fd.get("supplierId") as string,
      // Manual (distinta-imported) shipping has no inputs here: send no
      // shipping fields at all so the per-member charges stay as imported.
      ...(shippingMode !== "manual" && {
        shippingMode,
        shippingCostPerMember: fd.get("shippingCostPerMember") as string,
        shippingTotal: fd.get("shippingTotal") as string,
      }),
    };
    const openOnlyPatch = isClosed
      ? {}
      : {
          orderCloseAt: fd.get("orderCloseAt") as string,
          accessLevel: fd.get("accessLevel") as string,
          handlingFeeType: fd.get("handlingFeeType") as string,
          handlingFeeValue: fd.get("handlingFeeValue") as string,
        };
    startTransition(async () => {
      const result = await adminUpdateCycle(cycle.cycleId, {
        ...basePatch,
        ...openOnlyPatch,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (isClosed && result.adjustedMembers && result.adjustedMembers > 0) {
        toast.success(t.admin.cycle.cycleUpdatedShipping(result.adjustedMembers));
      } else {
        toast.success(t.admin.cycle.cycleUpdated);
      }
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isClosed && (
        <div className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-[12px] leading-snug text-brand-near-black">
          {t.admin.cycle.editClosedBanner}
        </div>
      )}
      <div>
        <label className="block">
          <span className={labelCls}>{t.admin.cycle.titleLabel}
          </span>
          <input
            name="title"
            required
            defaultValue={cycle.title}
            className={`w-full ${inputCls}`}
          />
        </label>
      </div>

      {!isClosed && (
        <div>
          <label className="block">
            <span className={labelCls}>{t.admin.cycle.orderCloseAtLabel}
            </span>
            <input
              name="orderCloseAt"
              type="datetime-local"
              required
              defaultValue={closeAtLocal}
              className={`w-full ${inputCls}`}
            />
          </label>
        </div>
      )}

      {shippingMode === "manual" ? (
        <div>
          <p className={labelCls}>{t.admin.cycle.shippingLabel}</p>
          <div className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-[12px] text-brand-near-black">
            <div className="font-bold text-primary-text">{t.admin.cycle.shippingManualTitle}</div>
            <p className="mt-1 text-brand-gray">
              {t.admin.cycle.shippingManualDescription}
            </p>
          </div>
        </div>
      ) : (
        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember={cycle.shippingCostPerMember ?? ""}
          defaultTotal={cycle.shippingTotal ?? ""}
        />
      )}

      {!isClosed && (
        <HandlingFeeFields
          defaultType={cycleFee?.type ?? "none"}
          defaultValue={cycleFee ? String(cycleFee.value) : ""}
          allowNone={!isPerOrder}
          warning={isPerOrder ? t.admin.cycle.handlingFeeEditWarning : undefined}
          note={isPerOrder && shippingMode === "proportional" ? t.admin.cycle.perOrderProportionalNote : null}
        />
      )}


      <PickupSection
        defPickup1Date={pickupLocal.slice(0, 10)}
        defPickup1Start={pickupLocal.slice(11, 16)}
        defPickup1End={cycle.pickupEndTime ?? ""}
        defPickup2Date={pickup2Local.slice(0, 10)}
        defPickup2Start={pickup2Local.slice(11, 16)}
        defPickup2End={cycle.pickup2EndTime ?? ""}
      />

      <div className={isClosed ? "" : "grid grid-cols-2 gap-3"}>
        <div>
          <label className="block">
            <span className={labelCls}>{t.admin.cycle.supplierLabel}
            </span>
            <select
              name="supplierId"
              defaultValue={cycle.supplierId ?? ""}
              className={`w-full ${inputCls}`}
            >
              <option value="">{t.admin.common.noSupplier}</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!isClosed && (
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.cycle.accessLabel}
              </span>
              <select
                name="accessLevel"
                defaultValue={normalizeAccessLevel(cycle.accessLevel) ?? DEFAULT_ACCESS_LEVEL}
                className={`w-full ${inputCls}`}
              >
                <AccessLevelOptions />
              </select>
            </label>
            <p className="mt-1 text-label text-muted">{t.admin.cycle.accessHint}</p>
          </div>
        )}
      </div>
      <div>
        <label className="block">
          <span className={labelCls}>{t.admin.common.notes}
          </span>
          <textarea
            name="notes"
            rows={2}
            defaultValue={cycle.notes ?? ""}
            className={`w-full ${inputCls}`}
          />
        </label>
        <p className="mt-1 text-label text-muted">{t.admin.cycle.notesHint}</p>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-primary py-2 text-[13px] font-bold text-on-primary disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.saveChanges}
      </button>
    </form>
  );
}

// Wallet or card, for a new cycle of a wallet group. Same look as the
// shipping and fee toggles.
function PaymentModeFields({
  mode,
  onModeChange,
}: {
  mode: "wallet" | "per_order";
  onModeChange: (mode: "wallet" | "per_order") => void;
}) {
  const options = [
    { v: "wallet" as const, label: t.admin.cycle.paymentModeWallet },
    { v: "per_order" as const, label: t.admin.cycle.paymentModeCard },
  ];
  return (
    <div>
      <p className={labelCls}>{t.admin.cycle.paymentModeLabel}</p>
      <div className="mb-2 flex rounded-lg bg-black/[0.05] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            aria-pressed={mode === opt.v}
            onClick={() => onModeChange(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-label font-semibold transition-colors ${
              mode === opt.v ? "bg-white text-brand-near-black shadow-sm" : "bg-transparent text-brand-gray"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-label text-muted">
        {mode === "per_order" ? t.admin.cycle.paymentModeCardHint : t.admin.cycle.paymentModeWalletHint}
      </p>
    </div>
  );
}

// ── Create Cycle Form ─────────────────────────────────────────────────────────

export function CreateCycleForm({
  suppliers,
  paymentMode: groupMode,
  cardSelectable,
  walletFee,
  cardFee,
  defaultOpen = false,
}: {
  suppliers: Supplier[];
  /** The group's mode: the default of a new cycle. */
  paymentMode: "wallet" | "per_order";
  /** A wallet group may pay this cycle by card (lib/payments/cycle-mode.ts). */
  cardSelectable: boolean;
  /** The fee a new cycle of each mode starts from; null = none. */
  walletFee: { type: "percent" | "fixed"; value: string } | null;
  cardFee: { type: "percent" | "fixed"; value: string } | null;
  /** Open from the start (the workspace's "+ Nuovo ciclo", or no cycle yet). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [paymentMode, setPaymentMode] = useState<"wallet" | "per_order">(groupMode);
  const handlingFee = paymentMode === "per_order" ? cardFee : walletFee;
  const [isPending, startTransition] = useTransition();
  const [shippingMode, setShippingMode] = useState<"fixed_per_member" | "proportional">(
    "fixed_per_member",
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: CreateCycleInput = {
      title: fd.get("title") as string,
      pickupDate: buildDateTime(fd.get("pickupDateOnly") as string, fd.get("pickupStartTime") as string),
      pickupEndTime: fd.get("pickupEndTime") as string,
      pickup2Date: buildDateTime(fd.get("pickup2DateOnly") as string, fd.get("pickup2StartTime") as string),
      pickup2EndTime: fd.get("pickup2EndTime") as string,
      orderCloseAt: fd.get("orderCloseAt") as string,
      supplierId: fd.get("supplierId") as string,
      accessLevel: fd.get("accessLevel") as string,
      notes: fd.get("notes") as string,
      shippingMode,
      shippingCostPerMember: fd.get("shippingCostPerMember") as string,
      shippingTotal: fd.get("shippingTotal") as string,
      handlingFeeType: fd.get("handlingFeeType") as string,
      handlingFeeValue: fd.get("handlingFeeValue") as string,
      paymentMode,
    };
    startTransition(async () => {
      const result = await adminCreateCycle(data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.admin.cycle.cycleCreated);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-primary/40 py-3 text-[13px] font-semibold text-primary-text"
      >
        {t.admin.cycle.createButton}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <p className="mb-3 text-[13px] font-bold text-brand-near-black">{t.admin.cycle.createTitle}</p>
      <div className="space-y-3">
        <div>
          <label className="block">
            <span className={labelCls}>{t.admin.cycle.titleLabel}
            </span>
            <input
              name="title"
              required
              placeholder={t.admin.cycle.titlePlaceholder}
              className={`w-full ${inputCls}`}
            />
          </label>
        </div>

        <div>
          <label className="block">
            <span className={labelCls}>{t.admin.cycle.orderCloseAtLabel}
            </span>
            <input
              name="orderCloseAt"
              type="datetime-local"
              required
              className={`w-full ${inputCls}`}
            />
          </label>
        </div>

        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember=""
          defaultTotal=""
        />

        {cardSelectable && <PaymentModeFields mode={paymentMode} onModeChange={setPaymentMode} />}

        <HandlingFeeFields
          // A new mode starts from its own last fee.
          key={paymentMode}
          defaultType={handlingFee?.type ?? "none"}
          defaultValue={handlingFee?.value ?? ""}
          allowNone={paymentMode === "wallet"}
          note={
            paymentMode === "per_order" && shippingMode === "proportional"
              ? t.admin.cycle.perOrderProportionalNote
              : null
          }
        />

        <PickupSection />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.cycle.supplierLabel}
              </span>
              <select name="supplierId" required defaultValue="" className={`w-full ${inputCls}`}>
                <option value="" disabled>{t.admin.common.selectPlaceholder}</option>
                {suppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.cycle.accessLabel}
              </span>
              <select name="accessLevel" defaultValue={DEFAULT_ACCESS_LEVEL} className={`w-full ${inputCls}`}>
                <AccessLevelOptions />
              </select>
            </label>
            <p className="mt-1 text-label text-muted">{t.admin.cycle.accessHint}</p>
          </div>
        </div>
        <div>
          <label className="block">
            <span className={labelCls}>{t.admin.common.notes}
            </span>
            <textarea
              name="notes"
              rows={2}
              className={`w-full ${inputCls}`}
            />
          </label>
          <p className="mt-1 text-label text-muted">{t.admin.cycle.notesHint}</p>
        </div>
      </div>
      {suppliers.length === 0 && (
        <p className="mt-2 text-label text-brand-red">{t.admin.products.noSupplierAvailable}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-primary py-2 text-[13px] font-bold text-on-primary disabled:opacity-60"
        >
          {isPending ? t.admin.cycle.creating : t.admin.cycle.createSubmit}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-gray"
        >
          {t.admin.common.cancel}
        </button>
      </div>
    </form>
  );
}

// ── Cycle Product Picker ──────────────────────────────────────────────────────

import { adminGetCatalogBySupplier, adminGetCycleProducts, adminRemoveProductFromCycle, adminLoadFromCatalog } from "@/lib/actions/admin";

type CycleProduct = {
  productId: string;
  name: string;
  variant: string | null;
  format: string | null;
  unitPrice: string;
  unit: string | null;
  supplierName: string | null;
};

export function CycleProductPicker({
  cycleId,
  suppliers,
}: {
  cycleId: string;
  suppliers: Supplier[];
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [catalog, setCatalog] = useState<CatalogProductItem[]>([]);
  const [currentProducts, setCurrentProducts] = useState<CycleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Load current products in cycle
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const prods = await adminGetCycleProducts(cycleId);
      if ("error" in prods) {
        toast.error(prods.error);
        return;
      }
      setCurrentProducts(prods as CycleProduct[]);
      if (selectedSupplierId) {
        const cat = await adminGetCatalogBySupplier(selectedSupplierId);
        if ("error" in cat) {
          toast.error(cat.error);
          return;
        }
        setCatalog(cat as CatalogProductItem[]);
      }
    } catch {
      toast.error(t.admin.products.errorLoadingProducts);
    } finally {
      setLoading(false);
    }
  }, [cycleId, selectedSupplierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleAdd(catalogProductId: string) {
    startTransition(async () => {
      const result = await adminLoadFromCatalog(cycleId, [catalogProductId]);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t.admin.products.productAdded);
        refresh();
      }
    });
  }

  async function handleRemove(productId: string) {
    if (!(await confirm({ title: t.admin.products.removeFromCycleConfirm, danger: true }))) return;
    startTransition(async () => {
      const result = await adminRemoveProductFromCycle(productId);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t.admin.products.productRemoved);
        refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-brand-near-black">{t.admin.products.cycleProductsTitle}</h4>
        <div className="text-label text-brand-gray">{t.admin.products.cycleProductsCount(currentProducts.length)}</div>
      </div>

      {currentProducts.length > 0 ? (
        <div className="space-y-4">
          {Array.from(new Set(currentProducts.map(p => p.supplierName || "Altro"))).map(sName => (
            <div key={sName} className="space-y-1">
              <div className="px-1 text-label font-bold uppercase tracking-wider text-muted">
                {sName}
              </div>
              <div className="divide-y divide-brand-border rounded-lg border border-brand-border bg-white overflow-hidden shadow-sm">
                {currentProducts.filter(p => (p.supplierName || "Altro") === sName).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between p-2.5 hover:bg-brand-warm-white/30">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-brand-near-black">{p.name}</div>
                      <div className="flex items-center gap-2 text-label text-brand-gray">
                        <span>{p.variant} {p.format && `(${p.format})`}</span>
                        <span className="font-mono font-bold text-primary-text">
                          {formatEur(parseFloat(p.unitPrice))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(p.productId)}
                      className="ml-2 min-h-9 rounded-lg bg-brand-red-light px-2 py-1 text-label font-bold text-brand-red hover:bg-brand-red/15"
                    >
                      {t.admin.products.removeFromCycle}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-brand-border py-4 text-center text-[12px] text-brand-gray">
          {t.admin.products.noCycleProducts}
        </div>
      )}

      <div className="mt-6 border-t border-brand-border pt-4">
        <h4 className="mb-3 text-[13px] font-bold text-brand-near-black">{t.admin.products.addFromCatalog}</h4>
        <select
          value={selectedSupplierId}
          onChange={(e) => setSelectedSupplierId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
        >
          <option value="">{t.admin.products.selectSupplierOption}</option>
          {suppliers.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {s.name}
            </option>
          ))}
        </select>

        {selectedSupplierId && (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-brand-gray text-[12px]">{t.admin.products.loadingCatalog}</div>
            ) : catalog.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto divide-y divide-brand-border rounded-lg border border-brand-border bg-[#fdfdfd]">
                {catalog.filter(cp => !currentProducts.some(p => p.name === cp.name && p.variant === cp.variant && p.format === cp.format)).map((cp) => (
                  <div key={cp.catalogProductId} className="flex items-center justify-between p-2.5 hover:bg-brand-warm-white/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-brand-near-black">{cp.name}</div>
                      <div className="flex items-center gap-2 text-label text-brand-gray">
                        <span>{cp.variant} {cp.format && `(${cp.format})`}</span>
                        <span className="font-mono font-bold text-primary-text">
                          {formatEur(parseFloat(cp.unitPrice))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(cp.catalogProductId)}
                      className="ml-2 rounded-lg bg-accent px-3 py-1 text-label font-bold text-on-accent"
                    >
                      {t.admin.products.addButton}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-brand-gray text-[12px]">{t.admin.products.noSupplierCatalog}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Supplier Actions Button ──────────────────────────────────────────────────

// Opens the SupplierActionsDialog hub with three sections: scarica xlsx,
// invia mail, carica distinta compilata. The button is enabled even when
// the supplier email is missing — the admin can type it directly into the
// dialog for that single send, and the download + carica distinta sections
// are useful regardless of email configuration. Disabled only when there
// is no supplier at all on the cycle, since most of the dialog's defaults
// derive from the supplier record.
export function SupplierActionsButton({
  cycleId,
  cycleTitle,
  supplierName,
}: {
  cycleId: string;
  cycleTitle: string;
  supplierName: string | null;
  // Kept on the call-site for parity with the previous API but no longer
  // gating the button — the dialog itself surfaces a missing-email case
  // by leaving the field empty for the admin to fill in.
  supplierEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const disabledReason = !supplierName ? t.admin.cycle.noSupplierDisabled : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!!disabledReason}
        title={disabledReason ?? undefined}
        className="rounded-lg bg-accent/10 px-3 py-1 text-label font-bold text-accent-text hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t.admin.cycle.supplierButton}
      </button>
      {open && (
        <SupplierActionsDialog
          open={open}
          onOpenChange={setOpen}
          cycleId={cycleId}
          cycleTitle={cycleTitle}
        />
      )}
    </>
  );
}

// ── Closed Cycle Edit Button ─────────────────────────────────────────────────

// Opens EditCycleForm in a sheet, for an open or a closed cycle. Reuses the
// same form to avoid drift; on a closed cycle the form adapts via the
// `isClosed` flag (warning banner + locked fields + ledger recompute).
export function EditCycleButton({
  cycle,
  suppliers,
  className,
}: {
  cycle: SerializedCycle;
  suppliers: Supplier[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isClosed = cycle.status !== "open";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "min-h-10 rounded-xl border border-brand-border bg-white px-3 text-[13px] font-semibold text-brand-near-black hover:bg-black/[0.03]"
        }
      >
        {isClosed ? t.admin.cycle.editClosedButton : t.admin.common.edit}
      </button>
      {open && (
        <Sheet
          open
          onRequestClose={() => setOpen(false)}
          title={cycle.title}
          subtitle={isClosed ? t.admin.cycle.editClosedLabel : undefined}
        >
          <EditCycleForm cycle={cycle} suppliers={suppliers} onClose={() => setOpen(false)} isClosed={isClosed} />
        </Sheet>
      )}
    </>
  );
}

/** From the overview to the cycle's orders, where they are read and corrected. */
export function OrdersLink({ cycleId }: { cycleId: string }) {
  return (
    <Link
      href={adminHref("ciclo", "ordini", { cycle: cycleId })}
      className="inline-flex min-h-10 items-center rounded-xl bg-accent/10 px-3 text-[13px] font-bold text-accent-text hover:bg-accent/20"
    >
      {t.admin.cycle.recapOrders}
    </Link>
  );
}

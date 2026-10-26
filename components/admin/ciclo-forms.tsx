"use client";

import { confirm } from "@/components/ui/confirm-dialog";
import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { formatDeadline, formatPickupSlot } from "@/lib/i18n/deadline";
import { t } from "@/lib/i18n";
import { formatMoney, formatHandlingFee } from "@/lib/i18n/format";
import { HANDLING_FEE_MAX, cycleHandlingFee } from "@/lib/payments/order-payment";
import type { ShippingDefault } from "@/lib/payments/new-cycle-defaults";
import { utcToZonedLocalInput } from "@/lib/i18n/zoned-time";
import {
  adminCreateCycle,
  adminUpdateCycle,
  type CreateCycleInput,
} from "@/lib/actions/admin";
import { formatEur } from "@/lib/utils";
import { ACCESS_LEVELS, DEFAULT_ACCESS_LEVEL, getAccessLabel, normalizeAccessLevel } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import type { CatalogProductItem } from "@/lib/db/queries";
import Link from "next/link";
import { adminHref } from "@/lib/admin/nav";
import { CycleReviewCloseButton } from "./cycle-review-modal";
import { ImportListingWizard } from "./import-listing-wizard";
import { Input } from "@/components/ui/input";
import { labelClass } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="space-y-1 text-[13px] text-secondary-foreground">
      {cycle.orderCloseAt && (
        <div>
          {t.admin.cycle.orderCloseAt}:{" "}
          <span className="font-semibold text-foreground">{formatDeadline(cycle.orderCloseAt)}</span>
        </div>
      )}
      {cycle.pickupDate && (
        <div>
          {cycle.pickup2Date ? t.admin.cycle.pickupFirst : t.admin.cycle.pickupSingle}{" "}
          <span className="font-semibold text-foreground">
            {formatPickupSlot(cycle.pickupDate, cycle.pickupEndTime ?? null)}
          </span>
        </div>
      )}
      {cycle.pickup2Date && (
        <div>
          {t.admin.cycle.pickupSecond}{" "}
          <span className="font-semibold text-foreground">
            {formatPickupSlot(cycle.pickup2Date, cycle.pickup2EndTime ?? null)}
          </span>
        </div>
      )}
      {cycle.shippingMode === "proportional" && cycle.shippingTotal && parseFloat(cycle.shippingTotal) > 0 && (
        <div>
          {t.admin.cycle.shippingLabel}:{" "}
          <span className="font-semibold text-foreground">
            {t.admin.cycle.shippingProportionalDisplay(formatMoney(cycle.shippingTotal))}
          </span>
        </div>
      )}
      {cycle.shippingMode !== "proportional" &&
        cycle.shippingCostPerMember &&
        parseFloat(cycle.shippingCostPerMember) > 0 && (
          <div>
            {t.admin.cycle.shippingLabel}:{" "}
            <span className="font-semibold text-foreground">
              {t.admin.cycle.shippingPerMemberDisplay(formatMoney(cycle.shippingCostPerMember))}
            </span>
          </div>
        )}
      <div>
        {t.admin.cycle.accessLabel}:{" "}
        <span className="font-semibold text-foreground">{getAccessLabel(cycle.accessLevel)}</span>
      </div>
    </div>
  );
}

/** Panoramica of an open cycle: how many ordered, the total, what to know before closing. */
export function OpenCycleOverview({ cycle, stats }: { cycle: SerializedCycle; stats: CycleStats }) {
  const { perOrderWarning } = closeWarnings(cycle, stats);
  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border px-3 py-2">
            <div className="text-label text-secondary-foreground">{t.admin.cycle.ordersCount}</div>
            <div className="text-[20px] font-bold text-foreground">{stats.orderCount}</div>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <div className="text-label text-secondary-foreground">{t.admin.cycle.totalAmount}</div>
            <div className="text-[20px] font-bold tabular-nums text-foreground">{formatEur(stats.grandTotal)}</div>
          </div>
        </div>
        {perOrderWarning && (
          <div className="mt-3 rounded-lg border border-primary-mid bg-primary-bg p-3 text-[13px] text-foreground">
            {perOrderWarning}
          </div>
        )}
        {cycle.isOverdue && (
          <div className="mt-3 rounded-lg border border-border border-l-4 border-l-destructive bg-background p-3 text-[13px] text-foreground">
            <p className="font-semibold">{t.admin.cycle.overdueWarning}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-secondary-foreground">
              {t.admin.cycle.overdueSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-3">
          <CycleFacts cycle={cycle} />
        </div>
        <div className="mt-3">
          <OrdersLink cycleId={cycle.cycleId} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Prodotti of an open cycle: import a price list, add from the catalogue, edit what is there. */
export function CycleProductsView({ cycle, suppliers }: { cycle: SerializedCycle; suppliers: Supplier[] }) {
  const [importing, setImporting] = useState(false);
  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-prose text-[13px] text-secondary-foreground">{t.admin.workspace.productsIntro}</p>
          <button
            onClick={() => setImporting(true)}
            className="min-h-(--control-h) rounded-xl border border-primary/30 bg-primary-bg px-3 text-[13px] font-bold text-primary-text"
          >
            {t.admin.cycle.importListing}
          </button>
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <CycleProductPicker cycleId={cycle.cycleId} suppliers={suppliers} />
        </div>
      </CardContent>
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

const miniLabelCls = "shrink-0 text-label font-medium text-secondary-foreground";

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
    <NativeSelect name={name} defaultValue={defValue ?? ""} aria-label={ariaLabel} wrapperClassName="min-w-0 flex-1" className="pl-2 pr-8 text-[13px]">
      <option value="">-</option>
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </NativeSelect>
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
      <span className="w-[46px] shrink-0 text-[12px] font-semibold text-foreground">{label}</span>
      <Input
        name={`${prefix}DateOnly`}
        type="date"
        aria-label={label}
        defaultValue={defDate}
        className="w-[140px] shrink-0 px-2 text-[13px]"
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
      <p className={labelClass}>{t.admin.cycle.pickupSection}</p>
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
              className="text-label font-semibold text-secondary-foreground hover:text-destructive"
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
      <p className={labelClass}>{t.admin.cycle.shippingLabel}</p>
      <div className="mb-2 flex rounded-lg bg-tint/[0.05] p-0.5">
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
                ? "bg-card text-foreground shadow-sm"
                : "bg-transparent text-secondary-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === "fixed_per_member" ? (
        <div>
          <Input
            name="shippingCostPerMember"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultPerMember}
            placeholder="0.00"
          />
          <p className="mt-1 text-label text-muted-foreground">
            {t.admin.cycle.shippingFixedHint}
          </p>
          {/* Hidden so the form data shape stays uniform across modes. */}
          <input type="hidden" name="shippingTotal" value="" />
        </div>
      ) : (
        <div>
          <Input
            name="shippingTotal"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultTotal}
            placeholder="0.00"
          />
          <p className="mt-1 text-label text-muted-foreground">
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
      <p className={labelClass}>{t.admin.cycle.handlingFeeLabel}</p>
      <div className="mb-2 flex rounded-lg bg-tint/[0.05] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setType(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-label font-semibold transition-colors ${
              type === opt.v ? "bg-card text-foreground shadow-sm" : "bg-transparent text-secondary-foreground"
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
        <Input
          name="handlingFeeValue"
          type="number"
          min="0"
          max={String(HANDLING_FEE_MAX[type])}
          step="0.01"
          required
          defaultValue={defaultValue}
          aria-label={t.admin.cycle.handlingFeeLabel}
        />
      )}
      <p className="mt-1 text-label text-muted-foreground">{t.admin.cycle.handlingFeeHint}</p>
      {note && <p className="mt-1 text-label text-secondary-foreground">{note}</p>}
      {warning && <p className="mt-1 text-label text-destructive">{warning}</p>}
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
        <div className="rounded-lg border border-primary/30 bg-primary-bg px-3 py-2 text-[12px] leading-snug text-foreground">
          {t.admin.cycle.editClosedBanner}
        </div>
      )}
      <div>
        <label className="block">
          <span className={labelClass}>{t.admin.cycle.titleLabel}
          </span>
          <Input
            name="title"
            required
            defaultValue={cycle.title}
          />
        </label>
      </div>

      {!isClosed && (
        <div>
          <label className="block">
            <span className={labelClass}>{t.admin.cycle.orderCloseAtLabel}
            </span>
            <Input
              name="orderCloseAt"
              type="datetime-local"
              required
              defaultValue={closeAtLocal}
            />
          </label>
        </div>
      )}

      {shippingMode === "manual" ? (
        <div>
          <p className={labelClass}>{t.admin.cycle.shippingLabel}</p>
          <div className="rounded-xl border border-primary/30 bg-primary-bg p-3 text-[12px] text-foreground">
            <div className="font-bold text-primary-text">{t.admin.cycle.shippingManualTitle}</div>
            <p className="mt-1 text-secondary-foreground">
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
            <span className={labelClass}>{t.admin.cycle.supplierLabel}
            </span>
            <NativeSelect
              name="supplierId"
              defaultValue={cycle.supplierId ?? ""}
            >
              <option value="">{t.admin.common.noSupplier}</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        {!isClosed && (
          <div>
            <label className="block">
              <span className={labelClass}>{t.admin.cycle.accessLabel}
              </span>
              <NativeSelect
                name="accessLevel"
                defaultValue={normalizeAccessLevel(cycle.accessLevel) ?? DEFAULT_ACCESS_LEVEL}
              >
                <AccessLevelOptions />
              </NativeSelect>
            </label>
            <p className="mt-1 text-label text-muted-foreground">{t.admin.cycle.accessHint}</p>
          </div>
        )}
      </div>
      <div>
        <label className="block">
          <span className={labelClass}>{t.admin.common.notes}
          </span>
          <Textarea
            name="notes"
            rows={2}
            defaultValue={cycle.notes ?? ""}
          />
        </label>
        <p className="mt-1 text-label text-muted-foreground">{t.admin.cycle.notesHint}</p>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-primary py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.saveChanges}
      </button>
    </form>
  );
}

// Wallet or card, for a new cycle of a wallet group. Same look as the
// shipping and fee toggles. With card cycles switched off in Impostazioni the
// card option stays in sight, greyed out, with the way to switch it on.
function PaymentModeFields({
  mode,
  onModeChange,
  cardDisabled = false,
}: {
  mode: "wallet" | "per_order";
  onModeChange: (mode: "wallet" | "per_order") => void;
  cardDisabled?: boolean;
}) {
  const options = [
    { v: "wallet" as const, label: t.admin.cycle.paymentModeWallet, disabled: false },
    { v: "per_order" as const, label: t.admin.cycle.paymentModeCard, disabled: cardDisabled },
  ];
  return (
    <div>
      <p className={labelClass}>{t.admin.cycle.paymentModeLabel}</p>
      <div className="mb-2 flex rounded-lg bg-tint/[0.05] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            aria-pressed={mode === opt.v}
            disabled={opt.disabled}
            aria-describedby={opt.disabled ? "payment-mode-card-off" : undefined}
            onClick={() => onModeChange(opt.v)}
            className={`flex-1 rounded-md py-1.5 text-label font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === opt.v ? "bg-card text-foreground shadow-sm" : "bg-transparent text-secondary-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-label text-muted-foreground">
        {mode === "per_order" ? t.admin.cycle.paymentModeCardHint : t.admin.cycle.paymentModeWalletHint}
      </p>
      {cardDisabled && (
        <p id="payment-mode-card-off" className="mt-1 text-label text-muted-foreground">
          {t.admin.cycle.paymentModeCardOff}{" "}
          {/* A full load: a client navigation does not scroll to the card, which renders below the fold. */}
          <a href={`${adminHref("impostazioni")}#cicli-carta`} className="font-semibold text-foreground underline underline-offset-2">
            {t.admin.cycle.paymentModeCardOffLink}
          </a>
        </p>
      )}
    </div>
  );
}

// ── Create Cycle Form ─────────────────────────────────────────────────────────

export function CreateCycleForm({
  suppliers,
  paymentMode: groupMode,
  cardSelectable,
  cardSwitchedOff = false,
  walletFee,
  cardFee,
  walletShipping = null,
  cardShipping = null,
  defaultOpen = false,
}: {
  suppliers: Supplier[];
  /** The mode a new cycle starts from (lib/payments/cycle-mode.ts, defaultNewCycleMode). */
  paymentMode: "wallet" | "per_order";
  /** A wallet group may pay this cycle by card (lib/payments/cycle-mode.ts). */
  cardSelectable: boolean;
  /** Card cycles would be possible but the group switched them off in Impostazioni: shown greyed out. */
  cardSwitchedOff?: boolean;
  /** The fee a new cycle of each mode starts from; null = none. */
  walletFee: { type: "percent" | "fixed"; value: string } | null;
  cardFee: { type: "percent" | "fixed"; value: string } | null;
  /** The shipping a new cycle of each mode starts from (Impostazioni); null = empty, per member. */
  walletShipping?: ShippingDefault | null;
  cardShipping?: ShippingDefault | null;
  /** Open from the start (the workspace's "+ Nuovo ciclo", or no cycle yet). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [paymentMode, setPaymentMode] = useState<"wallet" | "per_order">(groupMode);
  const handlingFee = paymentMode === "per_order" ? cardFee : walletFee;
  const shippingDefault = (mode: "wallet" | "per_order") => (mode === "per_order" ? cardShipping : walletShipping);
  const [isPending, startTransition] = useTransition();
  const [shippingMode, setShippingMode] = useState<"fixed_per_member" | "proportional">(
    shippingDefault(groupMode)?.mode ?? "fixed_per_member",
  );
  const shipping = shippingDefault(paymentMode);
  const shippingAmount = (mode: "fixed_per_member" | "proportional") =>
    shipping?.mode === mode && shipping.amount !== null ? String(shipping.amount) : "";

  // Another mode starts from its own defaults, shipping included.
  function changePaymentMode(mode: "wallet" | "per_order") {
    setPaymentMode(mode);
    setShippingMode(shippingDefault(mode)?.mode ?? "fixed_per_member");
  }

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
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-[13px] font-bold text-foreground">{t.admin.cycle.createTitle}</p>
      <div className="space-y-3">
        <div>
          <label className="block">
            <span className={labelClass}>{t.admin.cycle.titleLabel}
            </span>
            <Input
              name="title"
              required
              placeholder={t.admin.cycle.titlePlaceholder}
            />
          </label>
        </div>

        <div>
          <label className="block">
            <span className={labelClass}>{t.admin.cycle.orderCloseAtLabel}
            </span>
            <Input
              name="orderCloseAt"
              type="datetime-local"
              required
            />
          </label>
        </div>

        {(cardSelectable || cardSwitchedOff) && (
          <PaymentModeFields mode={paymentMode} onModeChange={changePaymentMode} cardDisabled={!cardSelectable} />
        )}

        <ShippingModeFields
          key={paymentMode}
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember={shippingAmount("fixed_per_member")}
          defaultTotal={shippingAmount("proportional")}
        />

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
              <span className={labelClass}>{t.admin.cycle.supplierLabel}
              </span>
              <NativeSelect name="supplierId" required defaultValue="">
                <option value="" disabled>{t.admin.common.selectPlaceholder}</option>
                {suppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelClass}>{t.admin.cycle.accessLabel}
              </span>
              <NativeSelect name="accessLevel" defaultValue={DEFAULT_ACCESS_LEVEL}>
                <AccessLevelOptions />
              </NativeSelect>
            </label>
            <p className="mt-1 text-label text-muted-foreground">{t.admin.cycle.accessHint}</p>
          </div>
        </div>
        <div>
          <label className="block">
            <span className={labelClass}>{t.admin.common.notes}
            </span>
            <Textarea
              name="notes"
              rows={2}
            />
          </label>
          <p className="mt-1 text-label text-muted-foreground">{t.admin.cycle.notesHint}</p>
        </div>
      </div>
      {suppliers.length === 0 && (
        <p className="mt-2 text-label text-destructive">{t.admin.products.noSupplierAvailable}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-primary py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {isPending ? t.admin.cycle.creating : t.admin.cycle.createSubmit}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-secondary-foreground"
        >
          {t.admin.common.cancel}
        </button>
      </div>
    </form>
  );
}

// ── Cycle Product Picker ──────────────────────────────────────────────────────

import { adminGetCatalogBySupplier, adminRemoveProductFromCycle, adminLoadFromCatalog } from "@/lib/actions/admin";
import {
  adminCopyProductOrderFromPrevious,
  adminGetCycleProducts,
  adminReorderCycleProducts,
  adminSetCycleProductOrder,
} from "@/lib/actions/admin-product-order";
import type { ProductOrderSource } from "@/lib/db/cycle-product-order";
import { EditCycleProductForm } from "./prodotti-forms";
import type { ProductOrderMode } from "@/lib/products/cycle-order";
import {
  ProductOrderSwitch,
  EditButton,
  PricePerKg,
  RemoveButton,
  SortableProductList,
  type OrderableProduct,
} from "./cycle-product-order";

type CycleProduct = OrderableProduct;

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
  const [productOrder, setProductOrder] = useState<ProductOrderMode>("alpha");
  const [copySource, setCopySource] = useState<ProductOrderSource | null>(null);
  // Bumped on every load: the sortable list starts again from the server.
  const [loadCount, setLoadCount] = useState(0);
  // The product whose edit form is open under its row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderPending, startOrderTransition] = useTransition();
  const [, startTransition] = useTransition();

  // Load current products in cycle
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetCycleProducts(cycleId);
      if ("error" in data) {
        toast.error(data.error);
        return;
      }
      setCurrentProducts(data.products);
      setProductOrder(data.productOrder);
      setCopySource(data.copySource);
      setLoadCount((n) => n + 1);
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

  function handleOrderMode(mode: ProductOrderMode) {
    startOrderTransition(async () => {
      const result = await adminSetCycleProductOrder(cycleId, mode);
      if (result.error) toast.error(result.error);
      await refresh();
    });
  }

  function handleReorder(productIds: string[]) {
    startOrderTransition(async () => {
      const result = await adminReorderCycleProducts(cycleId, productIds);
      if (result.error) {
        toast.error(result.error);
        await refresh();
      } else toast.success(t.admin.productOrder.saved, { id: "product-order-saved" });
    });
  }

  async function handleCopyOrder() {
    if (!(await confirm({ title: t.admin.productOrder.copyConfirm }))) return;
    startOrderTransition(async () => {
      const result = await adminCopyProductOrderFromPrevious(cycleId);
      if (result.error) toast.error(result.error);
      else if (result.source) toast.success(t.admin.productOrder.copied(result.source));
      await refresh();
    });
  }

  const knownCategories = Array.from(
    new Set(currentProducts.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c))),
  );

  function renderEditor(p: CycleProduct) {
    return (
      <EditCycleProductForm
        product={{ ...p, pricePerKg: p.pricePerKg ?? null, notes: p.notes ?? null }}
        knownCategories={knownCategories}
        onClose={() => {
          setEditingId(null);
          refresh();
        }}
      />
    );
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
        <h4 className="text-[13px] font-bold text-foreground">{t.admin.products.cycleProductsTitle}</h4>
        <div className="text-label text-secondary-foreground">{t.admin.products.cycleProductsCount(currentProducts.length)}</div>
      </div>

      {currentProducts.length > 1 && (
        <div className="space-y-3 rounded-lg bg-tint/[0.03] p-3">
          <ProductOrderSwitch mode={productOrder} disabled={orderPending} onChange={handleOrderMode} />
          {copySource && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={handleCopyOrder}
                disabled={orderPending}
                className="min-h-(--control-h) rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground disabled:opacity-60"
              >
                {t.admin.productOrder.copyButton}
              </button>
              <span className="text-label text-secondary-foreground">{t.admin.productOrder.copyHint(copySource.title)}</span>
            </div>
          )}
        </div>
      )}

      {currentProducts.length > 0 && productOrder === "custom" ? (
        <SortableProductList
          key={loadCount}
          products={currentProducts}
          onSave={handleReorder}
          onRemove={handleRemove}
          editingId={editingId}
          onEdit={setEditingId}
          renderEditor={renderEditor}
        />
      ) : currentProducts.length > 0 ? (
        <div className="space-y-4">
          {Array.from(new Set(currentProducts.map(p => p.supplierName || "Altro"))).map(sName => (
            <div key={sName} className="space-y-1">
              <div className="px-1 text-label font-bold uppercase tracking-wider text-muted-foreground">
                {sName}
              </div>
              <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden shadow-sm">
                {currentProducts.filter(p => (p.supplierName || "Altro") === sName).map((p) => (
                  <div key={p.productId}>
                    <div className="flex items-center justify-between p-2.5 hover:bg-background/30">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-foreground">{p.name}</div>
                        <div className="flex items-center gap-2 text-label text-secondary-foreground">
                          <span>{p.variant} {p.format && `(${p.format})`}</span>
                          <span className="tabular-nums font-bold text-primary-text">
                            {formatEur(parseFloat(p.unitPrice))}
                          </span>
                          <PricePerKg value={p.pricePerKg} />
                        </div>
                      </div>
                      <EditButton
                        name={p.name}
                        expanded={editingId === p.productId}
                        onEdit={() => setEditingId(p.productId)}
                      />
                      <RemoveButton name={p.name} onRemove={() => handleRemove(p.productId)} />
                    </div>
                    {editingId === p.productId && <div className="px-2 pb-2">{renderEditor(p)}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-4 text-center text-[12px] text-secondary-foreground">
          {t.admin.products.noCycleProducts}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <h4 className="mb-3 text-[13px] font-bold text-foreground">{t.admin.products.addFromCatalog}</h4>
        <NativeSelect
          value={selectedSupplierId}
          onChange={(e) => setSelectedSupplierId(e.target.value)}
          wrapperClassName="mb-4"
        >
          <option value="">{t.admin.products.selectSupplierOption}</option>
          {suppliers.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {s.name}
            </option>
          ))}
        </NativeSelect>

        {selectedSupplierId && (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-secondary-foreground text-[12px]">{t.admin.products.loadingCatalog}</div>
            ) : catalog.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border rounded-lg border border-border bg-background">
                {catalog.filter(cp => !currentProducts.some(p => p.name === cp.name && p.variant === cp.variant && p.format === cp.format)).map((cp) => (
                  <div key={cp.catalogProductId} className="flex items-center justify-between p-2.5 hover:bg-background/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-foreground">{cp.name}</div>
                      <div className="flex items-center gap-2 text-label text-secondary-foreground">
                        <span>{cp.variant} {cp.format && `(${cp.format})`}</span>
                        <span className="tabular-nums font-bold text-primary-text">
                          {formatEur(parseFloat(cp.unitPrice))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(cp.catalogProductId)}
                      className="ml-2 rounded-lg bg-accent px-3 py-1 text-label font-bold text-accent-foreground"
                    >
                      {t.admin.products.addButton}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-secondary-foreground text-[12px]">{t.admin.products.noSupplierCatalog}</div>
            )}
          </div>
        )}
      </div>
    </div>
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
          "min-h-(--control-h) rounded-xl border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-tint/[0.03]"
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
      className="inline-flex min-h-(--control-h) items-center text-[13px] font-bold text-primary-text underline-offset-2 hover:underline"
    >
      {t.admin.cycle.recapOrders}
    </Link>
  );
}

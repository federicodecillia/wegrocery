"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import { formatMoney, formatDateTime } from "@/lib/i18n/format";
import {
  adminCloseCycle,
  adminCreateCycle,
  adminUpdateCycle,
  type CreateCycleInput,
} from "@/lib/actions/admin";
import { formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { CatalogProductItem } from "@/lib/db/queries";
import { ClosedCycleDetails } from "./closed-cycle-details";
import { CycleReviewCloseButton } from "./cycle-review-modal";
import { SupplierActionsDialog } from "./supplier-actions-dialog";
import { ImportListingWizard } from "./import-listing-wizard";

type Supplier = { supplierId: string; name: string };

type SerializedCycle = {
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
};

// ── Open Cycle Card ───────────────────────────────────────────────────────────

export function OpenCycleCard({
  cycle,
  stats,
  suppliers,
}: {
  cycle: SerializedCycle;
  stats: { orderCount: number; grandTotal: number };
  suppliers: Supplier[];
}) {
  const [editing, setEditing] = useState(false);
  const [managingProducts, setManagingProducts] = useState(false);
  const [importingListing, setImportingListing] = useState(false);

  return (
    <Card className="mb-4 border-l-4 border-l-brand-teal">
      {/* The title stacks above a wrapping button row so the five actions
          always wrap within the card instead of overflowing — the app caps at
          640px, too narrow to ever fit them on one line beside the title. */}
      <CardHeader className="flex flex-col items-start gap-3">
        <div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-brand-teal-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
            {t.admin.cycle.openBadge}
          </span>
          <h3 className="mt-1 text-[15px] font-bold text-brand-near-black">{cycle.title}</h3>
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <button
            onClick={() => setManagingProducts((v) => !v)}
            className="rounded-xl border border-brand-teal/30 bg-brand-teal-light px-3 py-1.5 text-[11px] font-bold text-brand-teal"
          >
            {managingProducts ? t.admin.cycle.closeProducts : t.admin.cycle.manageProducts}
          </button>
          <button
            onClick={() => setImportingListing(true)}
            className="rounded-xl border border-brand-orange/30 bg-brand-orange-light px-3 py-1.5 text-[11px] font-bold text-brand-orange"
          >
            {t.admin.cycle.importListing}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-xl border border-brand-border px-3 py-1.5 text-[11px] font-semibold text-brand-gray"
          >
            {editing ? t.admin.common.cancel : t.admin.common.edit}
          </button>
          <CycleReviewCloseButton cycleId={cycle.cycleId} cycleTitle={cycle.title} />
          <CloseCycleButton cycleId={cycle.cycleId} cycleTitle={cycle.title} />
        </div>
      </CardHeader>
      {editing ? (
        <CardBody>
          <EditCycleForm cycle={cycle} suppliers={suppliers} onClose={() => setEditing(false)} />
        </CardBody>
      ) : (
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-brand-orange-light px-3 py-2">
              <div className="font-mono text-[11px] text-brand-gray">{t.admin.cycle.ordersCount}</div>
              <div className="text-[20px] font-bold text-brand-near-black">{stats.orderCount}</div>
            </div>
            <div className="rounded-lg bg-brand-teal-light px-3 py-2">
              <div className="font-mono text-[11px] text-brand-gray">{t.admin.cycle.totalAmount}</div>
              <div className="text-[20px] font-bold text-brand-near-black">
                {formatEur(stats.grandTotal)}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-[12px] text-brand-gray">
            {cycle.isOverdue && (
              <div className="rounded-lg border border-brand-red/30 bg-brand-red-light p-3 text-brand-red">
                {t.admin.cycle.overdueWarning}
              </div>
            )}
            {cycle.orderCloseAt && (
              <div>
                {t.admin.cycle.orderCloseAt}:{" "}
                <span className="font-semibold text-brand-near-black">
                  {formatDateTime(new Date(cycle.orderCloseAt), {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {cycle.pickupDate && (
              <div>
                {cycle.pickup2Date ? t.admin.cycle.pickupFirst : t.admin.cycle.pickupSingle}{" "}
                <span className="font-semibold text-brand-near-black">
                  {formatDateTime(new Date(cycle.pickupDate), {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {cycle.pickupEndTime && `–${cycle.pickupEndTime}`}
                </span>
              </div>
            )}
            {cycle.pickup2Date && (
              <div>
                {t.admin.cycle.pickupSecond}{" "}
                <span className="font-semibold text-brand-near-black">
                  {formatDateTime(new Date(cycle.pickup2Date), {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {cycle.pickup2EndTime && `–${cycle.pickup2EndTime}`}
                </span>
              </div>
            )}
            {cycle.shippingMode === "proportional" &&
              cycle.shippingTotal &&
              parseFloat(cycle.shippingTotal) > 0 && (
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
          </div>
          <div className="mt-3">
            <ClosedCycleDetails
              cycleId={cycle.cycleId}
              cycleTitle={cycle.title}
              buttonLabel={t.admin.cycle.recapOrders}
            />
          </div>
          {managingProducts && (
            <div className="mt-6 border-t border-brand-border pt-4">
              <CycleProductPicker cycleId={cycle.cycleId} suppliers={suppliers} />
            </div>
          )}
        </CardBody>
      )}
      <ImportListingWizard
        open={importingListing}
        onClose={() => setImportingListing(false)}
        cycleId={cycle.cycleId}
        cycleTitle={cycle.title}
      />
    </Card>
  );
}

// ── Edit Cycle Form ───────────────────────────────────────────────────────────

function buildDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

const inputCls = "rounded-lg border border-brand-border px-2 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-orange/30";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-gray";
const miniLabelCls = "shrink-0 text-[11px] font-medium text-brand-gray";

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
function TimeSlotSelect({ name, defValue }: { name: string; defValue?: string }) {
  const options = defValue && !TIME_SLOTS.includes(defValue) ? [defValue, ...TIME_SLOTS] : TIME_SLOTS;
  return (
    <select name={name} defaultValue={defValue ?? ""} className={`min-w-0 flex-1 ${inputCls}`}>
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
        defaultValue={defDate}
        className={`w-[140px] shrink-0 ${inputCls}`}
      />
      <div className="flex min-w-[190px] flex-1 items-center gap-1.5">
        <span className={miniLabelCls}>{t.admin.cycle.timeFrom}</span>
        <TimeSlotSelect name={`${prefix}StartTime`} defValue={defStart} />
        <span className={miniLabelCls}>{t.admin.cycle.timeTo}</span>
        <TimeSlotSelect name={`${prefix}EndTime`} defValue={defEnd} />
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
      <label className={labelCls}>{t.admin.cycle.pickupSection}</label>
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
              className="text-[11px] font-semibold text-brand-gray hover:text-brand-red"
            >
              {t.admin.cycle.removePickup2}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowPickup2(true)}
            className="text-[12px] font-semibold text-brand-orange hover:underline"
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
      <label className={labelCls}>{t.admin.cycle.shippingLabel}</label>
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
            className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
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
          <p className="mt-1 text-[10px] text-brand-gray-light">
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
          <p className="mt-1 text-[10px] text-brand-gray-light">
            {t.admin.cycle.shippingProportionalHint}
          </p>
          <input type="hidden" name="shippingCostPerMember" value="" />
        </div>
      )}
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
      shippingMode,
      shippingCostPerMember: fd.get("shippingCostPerMember") as string,
      shippingTotal: fd.get("shippingTotal") as string,
    };
    const openOnlyPatch = isClosed
      ? {}
      : {
          orderCloseAt: fd.get("orderCloseAt") as string,
          accessLevel: fd.get("accessLevel") as string,
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
        <div className="rounded-lg border border-brand-orange/30 bg-brand-orange-light px-3 py-2 text-[12px] leading-snug text-brand-near-black">
          {t.admin.cycle.editClosedBanner}
        </div>
      )}
      <div>
        <label className={labelCls}>{t.admin.cycle.titleLabel}</label>
        <input
          name="title"
          required
          defaultValue={cycle.title}
          className={`w-full ${inputCls}`}
        />
      </div>

      {!isClosed && (
        <div>
          <label className={labelCls}>{t.admin.cycle.orderCloseAtLabel}</label>
          <input
            name="orderCloseAt"
            type="datetime-local"
            required
            defaultValue={cycle.orderCloseAt?.slice(0, 16) ?? ""}
            className={`w-full ${inputCls}`}
          />
        </div>
      )}

      {shippingMode === "manual" ? (
        <div>
          <label className={labelCls}>{t.admin.cycle.shippingLabel}</label>
          <div className="rounded-xl border border-brand-orange/30 bg-brand-orange-light p-3 text-[12px] text-brand-near-black">
            <div className="font-bold text-brand-orange">{t.admin.cycle.shippingManualTitle}</div>
            <p className="mt-1 text-brand-gray">
              {t.admin.cycle.shippingManualDescription}
            </p>
          </div>
          <input type="hidden" name="shippingCostPerMember" value="" />
          <input type="hidden" name="shippingTotal" value="" />
        </div>
      ) : (
        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember={cycle.shippingCostPerMember ?? ""}
          defaultTotal={cycle.shippingTotal ?? ""}
        />
      )}


      <PickupSection
        defPickup1Date={cycle.pickupDate?.slice(0, 10) ?? ""}
        defPickup1Start={cycle.pickupDate?.slice(11, 16) ?? ""}
        defPickup1End={cycle.pickupEndTime ?? ""}
        defPickup2Date={cycle.pickup2Date?.slice(0, 10) ?? ""}
        defPickup2Start={cycle.pickup2Date?.slice(11, 16) ?? ""}
        defPickup2End={cycle.pickup2EndTime ?? ""}
      />

      <div className={isClosed ? "" : "grid grid-cols-2 gap-3"}>
        <div>
          <label className={labelCls}>{t.admin.cycle.supplierLabel}</label>
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
        </div>
        {!isClosed && (
          <div>
            <label className={labelCls}>{t.admin.cycle.accessLabel}</label>
            <select
              name="accessLevel"
              defaultValue={cycle.accessLevel}
              className={`w-full ${inputCls}`}
            >
              <option value="admin">{t.admin.cycle.accessAdminOnly}</option>
              <option value="soci">{t.admin.cycle.accessActiveSoci}</option>
              <option value="utenti">{t.admin.cycle.accessAllUsers}</option>
            </select>
          </div>
        )}
      </div>
      <div>
        <label className={labelCls}>{t.admin.common.notes}</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={cycle.notes ?? ""}
          className={`w-full ${inputCls}`}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-brand-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : t.admin.common.saveChanges}
      </button>
    </form>
  );
}

// ── Create Cycle Form ─────────────────────────────────────────────────────────

export function CreateCycleForm({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
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
        className="w-full rounded-xl border-2 border-dashed border-brand-orange/40 py-3 text-[13px] font-semibold text-brand-orange"
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
          <label className={labelCls}>{t.admin.cycle.titleLabel}</label>
          <input
            name="title"
            required
            placeholder={t.admin.cycle.titlePlaceholder}
            className={`w-full ${inputCls}`}
          />
        </div>

        <div>
          <label className={labelCls}>{t.admin.cycle.orderCloseAtLabel}</label>
          <input
            name="orderCloseAt"
            type="datetime-local"
            required
            className={`w-full ${inputCls}`}
          />
        </div>

        <ShippingModeFields
          mode={shippingMode}
          onModeChange={setShippingMode}
          defaultPerMember=""
          defaultTotal=""
        />

        <PickupSection />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t.admin.cycle.supplierLabel}</label>
            <select name="supplierId" required defaultValue="" className={`w-full ${inputCls}`}>
              <option value="" disabled>{t.admin.common.selectPlaceholder}</option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.admin.cycle.accessLabel}</label>
            <select name="accessLevel" defaultValue="soci" className={`w-full ${inputCls}`}>
              <option value="admin">{t.admin.cycle.accessAdminOnly}</option>
              <option value="soci">{t.admin.cycle.accessActiveSoci}</option>
              <option value="utenti">{t.admin.cycle.accessAllUsers}</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t.admin.common.notes}</label>
          <textarea
            name="notes"
            rows={2}
            className={`w-full ${inputCls}`}
          />
        </div>
      </div>
      {suppliers.length === 0 && (
        <p className="mt-2 text-[11px] text-brand-red">{t.admin.products.noSupplierAvailable}</p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-brand-orange py-2 text-[13px] font-bold text-white disabled:opacity-60"
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

// ── Close Cycle Button ────────────────────────────────────────────────────────

export function CloseCycleButton({ cycleId, cycleTitle }: { cycleId: string; cycleTitle: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (!window.confirm(t.admin.cycle.closeCycleConfirm(cycleTitle))) return;
    startTransition(async () => {
      try {
        const result = await adminCloseCycle(cycleId);
        toast.success(t.admin.cycle.cycleClosed(result.chargesGenerated));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  return (
    <button
      onClick={handleClose}
      disabled={isPending}
      className="rounded-xl border border-brand-red/30 bg-brand-red-light px-4 py-2 text-[12px] font-bold text-brand-red disabled:opacity-60"
    >
      {isPending ? t.admin.cycle.closingCycle : t.admin.cycle.closeCycle}
    </button>
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
      setCurrentProducts(prods as CycleProduct[]);
      if (selectedSupplierId) {
        const cat = await adminGetCatalogBySupplier(selectedSupplierId);
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

  function handleRemove(productId: string) {
    if (!window.confirm(t.admin.products.removeFromCycleConfirm)) return;
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
        <div className="text-[11px] text-brand-gray">{t.admin.products.cycleProductsCount(currentProducts.length)}</div>
      </div>

      {currentProducts.length > 0 ? (
        <div className="space-y-4">
          {Array.from(new Set(currentProducts.map(p => p.supplierName || "Altro"))).map(sName => (
            <div key={sName} className="space-y-1">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-brand-gray-light">
                {sName}
              </div>
              <div className="divide-y divide-brand-border rounded-lg border border-brand-border bg-white overflow-hidden shadow-sm">
                {currentProducts.filter(p => (p.supplierName || "Altro") === sName).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between p-2.5 hover:bg-brand-warm-white/30">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-brand-near-black">{p.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-brand-gray">
                        <span>{p.variant} {p.format && `(${p.format})`}</span>
                        <span className="font-mono font-bold text-brand-orange">
                          {formatEur(parseFloat(p.unitPrice))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(p.productId)}
                      className="ml-2 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
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
          className="mb-4 w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
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
                      <div className="flex items-center gap-2 text-[10px] text-brand-gray">
                        <span>{cp.variant} {cp.format && `(${cp.format})`}</span>
                        <span className="font-mono font-bold text-brand-orange">
                          {formatEur(parseFloat(cp.unitPrice))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(cp.catalogProductId)}
                      className="ml-2 rounded-lg bg-brand-teal px-3 py-1 text-[10px] font-bold text-white hover:bg-brand-teal-dark"
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
        className="rounded-lg bg-brand-teal/10 px-3 py-1 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/20 disabled:cursor-not-allowed disabled:opacity-50"
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

// Lightweight wrapper that opens EditCycleForm in a modal for a closed cycle.
// Reuses the same form to avoid drift; the form itself adapts via the
// `isClosed` flag (warning banner + locked fields + ledger recompute).
export function ClosedCycleEditButton({
  cycle,
  suppliers,
}: {
  cycle: SerializedCycle;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-orange/10 px-3 py-1 text-[11px] font-bold text-brand-orange hover:bg-brand-orange/20"
      >
        {t.admin.cycle.editClosedButton}
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[600px] flex-col rounded-2xl bg-brand-warm-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-brand-border p-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-brand-orange">
              {t.admin.cycle.editClosedLabel}
            </div>
            <h3 className="mt-1 text-[16px] font-black text-brand-near-black">{cycle.title}</h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full bg-brand-border p-2 text-brand-gray hover:bg-brand-gray-light"
            aria-label={t.admin.common.close}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <EditCycleForm
            cycle={cycle}
            suppliers={suppliers}
            onClose={() => setOpen(false)}
            isClosed
          />
        </div>
      </div>
    </div>
  );
}

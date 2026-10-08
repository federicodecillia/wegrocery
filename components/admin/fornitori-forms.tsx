"use client";

import { confirm } from "@/components/ui/confirm-dialog";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import {
  adminArchiveSupplier,
  adminDeleteSupplier,
  adminUpsertSupplier,
  type UpsertSupplierInput,
} from "@/lib/actions/admin";
import { adminHref } from "@/lib/admin/nav";
import { t } from "@/lib/i18n";
import { useCloseCreate } from "./create-toggle";

type Supplier = {
  supplierId: string;
  name: string;
  macroCategory: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  cycleCount: number;
};

// ── Supplier Form ─────────────────────────────────────────────────────────────

export function FornitoriForm({
  supplier,
  onClose,
}: {
  supplier?: Supplier;
  onClose?: () => void;
}) {
  const closeCreate = useCloseCreate();
  const close = onClose ?? closeCreate;
  const [isPending, startTransition] = useTransition();
  const isEdit = !!supplier;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: UpsertSupplierInput = {
      supplierId: supplier?.supplierId,
      name: fd.get("name") as string,
      macroCategory: (fd.get("macroCategory") as string) || undefined,
      contactName: (fd.get("contactName") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      address: (fd.get("address") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
      active: true,
    };
    startTransition(async () => {
      try {
        const result = await adminUpsertSupplier(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(isEdit ? t.admin.suppliers.supplierUpdated : t.admin.suppliers.supplierAdded);
        close?.();
        if (!isEdit) (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black";
  const labelCls = "mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-brand-border bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-brand-near-black">
          {isEdit ? t.admin.suppliers.editSupplier(supplier.name) : t.admin.suppliers.addSupplier}
        </p>
        {close && (
          <button type="button" onClick={close} className="text-label text-brand-gray">
            ✕ {t.admin.common.cancel}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.nameLabel}
              </span>
              <input name="name" required defaultValue={supplier?.name} className={inputCls} />
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.categoryLabel}
              </span>
              <input
                name="macroCategory"
                placeholder={t.admin.suppliers.categoryPlaceholder}
                defaultValue={supplier?.macroCategory ?? ""}
                className={inputCls}
              />
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.contactLabel}
              </span>
              <input
                name="contactName"
                defaultValue={supplier?.contactName ?? ""}
                className={inputCls}
              />
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.phoneLabel}
              </span>
              <input
                name="phone"
                type="tel"
                defaultValue={supplier?.phone ?? ""}
                className={inputCls}
              />
            </label>
          </div>
          <div>
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.emailLabel}
              </span>
              <input
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ""}
                className={inputCls}
              />
            </label>
          </div>
          <div className="col-span-2">
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.addressLabel}
              </span>
              <input
                name="address"
                defaultValue={supplier?.address ?? ""}
                className={inputCls}
              />
            </label>
          </div>
          <div className="col-span-2">
            <label className="block">
              <span className={labelCls}>{t.admin.suppliers.notesLabel}
              </span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={supplier?.notes ?? ""}
                className={inputCls}
              />
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-primary py-2 text-[13px] font-bold text-on-primary disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : isEdit ? t.admin.suppliers.submitEdit : t.admin.suppliers.submitAdd}
      </button>
    </form>
  );
}

// ── Supplier List ─────────────────────────────────────────────────────────────

export function FornitoriList({
  suppliers,
  productCounts,
}: {
  suppliers: Supplier[];
  /** Active catalogue products per supplier; edited in Catalogo → Prodotti. */
  productCounts: Record<string, number>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [, startTransition] = useTransition();

  function handleArchive(s: Supplier) {
    startTransition(async () => {
      try {
        const result = await adminArchiveSupplier(s.supplierId, !s.active);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(s.active ? t.admin.suppliers.supplierArchived : t.admin.suppliers.supplierReactivated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  async function handleDelete(s: Supplier) {
    if (!(await confirm({ title: t.admin.suppliers.deleteConfirm(s.name), danger: true }))) return;
    startTransition(async () => {
      const result = await adminDeleteSupplier(s.supplierId);
      if (result?.error) toast.error(result.error);
      else toast.success(t.admin.suppliers.supplierDeleted(s.name));
    });
  }

  const query = filter.toLowerCase().trim();
  const filtered = query
    ? suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.macroCategory?.toLowerCase().includes(query) ||
          s.email?.toLowerCase().includes(query),
      )
    : suppliers;

  const active = filtered.filter((s) => s.active);
  const archived = filtered.filter((s) => !s.active);

  function renderGroup(label: string, list: Supplier[]) {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1 px-1 font-mono text-label uppercase tracking-wider text-muted">
          {label} ({list.length})
        </p>
        <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm">
          {list.map((s) => (
            <div key={s.supplierId} className="divide-y divide-brand-border">
              {editingId === s.supplierId ? (
                <div className="p-4">
                  <FornitoriForm supplier={s} onClose={() => setEditingId(null)} />
                </div>
              ) : (
                <>
                  {/* Supplier row: the name toggles the details, the actions
                      sit beside it (never inside it: no nested controls). */}
                  <div className="flex items-center gap-2 border-b border-brand-border pr-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === s.supplierId ? null : s.supplierId)}
                      aria-expanded={expandedId === s.supplierId}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left"
                    >
                      <span aria-hidden className="text-label text-muted">
                        {expandedId === s.supplierId ? "▲" : "▼"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-brand-near-black">{s.name}</span>
                          {!s.active && (
                            <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-label font-bold text-brand-gray">
                              {t.admin.suppliers.archivedBadge}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-label text-muted">
                          {s.macroCategory && `${s.macroCategory} · `}
                          {s.contactName && `${s.contactName} · `}
                          {t.admin.suppliers.cyclesCount(s.cycleCount)}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(s.supplierId)}
                        className="min-h-9 rounded-full border border-brand-border px-3 py-1 text-label font-semibold text-brand-gray"
                      >
                        {t.admin.common.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(s)}
                        className="min-h-9 rounded-full border border-brand-border px-3 py-1 text-label font-semibold text-brand-gray"
                      >
                        {s.active ? t.admin.common.archive : t.admin.common.restore}
                      </button>
                      {s.cycleCount === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          aria-label={t.admin.suppliers.deleteAria(s.name)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-red/30 text-label font-semibold text-brand-red"
                        >
                          <span aria-hidden>✕</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contact details + products */}
                  {expandedId === s.supplierId && (
                    <div className="bg-black/[0.01] px-4 py-3">
                      {(s.phone || s.email || s.address) && (
                        <div className="mb-3 space-y-0.5 font-mono text-label text-brand-gray">
                          {s.phone && <div>📞 {s.phone}</div>}
                          {s.email && <div>✉ {s.email}</div>}
                          {s.address && <div>📍 {s.address}</div>}
                          {s.notes && <div className="mt-1 italic text-muted">{s.notes}</div>}
                        </div>
                      )}

                      {/* The catalogue is edited in one place: Catalogo → Prodotti. */}
                      <Link
                        href={adminHref("catalogo", "prodotti", { supplier: s.supplierId })}
                        className="inline-flex min-h-10 items-center text-[13px] font-semibold text-primary-text"
                      >
                        {t.admin.suppliers.productsLink(productCounts[s.supplierId] ?? 0)}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder={t.admin.suppliers.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-brand-border px-4 py-2.5 text-[13px] text-brand-near-black"
        />
      </div>
      {renderGroup(t.admin.suppliers.groupActive, active)}
      {renderGroup(t.admin.suppliers.groupArchived, archived)}
      {suppliers.length === 0 && (
        <div className="rounded-xl border border-dashed border-brand-border p-6 text-center text-[13px] text-brand-gray">
          {t.admin.suppliers.noSuppliers}
        </div>
      )}
    </div>
  );
}

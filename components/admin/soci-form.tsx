"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { adminDeleteMember, adminInviteMember, adminUpsertMember, type UpsertMemberInput } from "@/lib/actions/admin";
import { adminUnlinkFamilyMember } from "@/lib/actions/family";
import { formatDate } from "@/lib/utils";
import { DEFAULT_ROLE, ROLES, getRoleLabel, normalizeRole, type Role } from "@/lib/roles";
import { t } from "@/lib/i18n";
import { useCloseCreate } from "./create-toggle";
import { adminHref } from "@/lib/admin/nav";
import type { DuplicatePair } from "@/lib/members/duplicates";
import { DuplicateMembers } from "./duplicate-members";
import { MergeMembersDialog } from "./merge-members-dialog";
import { Sheet } from "@/components/ui/sheet";

type Member = {
  memberId: string;
  fullName: string;
  email: string;
  aliasEmail: string | null;
  role: string;
  active: boolean;
  paysOffline?: boolean;
  lastLoginAt?: string | null;
  balance?: number;
  // Absorbed by another account that stays (lib/members/merge.ts): its name.
  mergedIntoName?: string | null;
  // Joined another account as family (members.household_of): its name.
  householdOfName?: string | null;
  // People who joined this account as family: their names.
  familyNames?: string | null;
};

type MergeRequest = { absorbedId: string; survivorId?: string };

export function SociForm({
  member,
  onClose,
  offlineOption = false,
  onMergeRequest,
}: {
  member?: Member;
  onClose?: () => void;
  offlineOption?: boolean;
  // Editing a member and typing another member's address: offer the merge.
  onMergeRequest?: (request: MergeRequest) => void;
}) {
  const closeCreate = useCloseCreate();
  const close = onClose ?? closeCreate;
  const [isPending, startTransition] = useTransition();
  const isEdit = !!member;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: UpsertMemberInput = {
      memberId: member?.memberId,
      fullName: fd.get("fullName") as string,
      email: fd.get("email") as string,
      aliasEmail: (fd.get("aliasEmail") as string) || undefined,
      role: fd.get("role") as string,
      active: fd.get("active") === "true",
      // Left out when the option is hidden, so the saved value stays.
      paysOffline: offlineOption ? fd.get("paysOffline") === "on" : undefined,
    };
    startTransition(async () => {
      try {
        const result = await adminUpsertMember(data);
        if (result?.conflict && member && onMergeRequest) {
          const merge = await confirm({
            title: t.admin.members.merge.emailHeldTitle,
            message: t.admin.members.merge.emailHeldPrompt(result.conflict.address, result.conflict.fullName),
            confirmLabel: t.admin.members.merge.emailHeldConfirm,
            cancelLabel: t.admin.common.cancel,
          });
          if (merge) onMergeRequest({ absorbedId: result.conflict.memberId, survivorId: member.memberId });
          return;
        }
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(isEdit ? t.admin.members.memberUpdated : t.admin.members.memberAdded);
        close?.();
        if (!isEdit) (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.admin.common.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-brand-near-black">
          {isEdit ? t.admin.members.editMember(member.fullName) : t.admin.members.addMember}
        </p>
        {close && (
          <button type="button" onClick={close} className="text-label text-brand-gray">
            ✕ {t.admin.common.cancel}
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">
              {t.admin.members.nameLabel}
            </span>
            <input
              name="fullName"
              required
              defaultValue={member?.fullName}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
            />
          </label>
        </div>
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">
              {t.admin.members.emailLabel}
            </span>
            <input
              name="email"
              type="email"
              required
              defaultValue={member?.email}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
            />
          </label>
        </div>
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">
              {t.admin.members.aliasEmailLabel}
              <span className="ml-1 font-normal normal-case text-muted">{t.admin.members.aliasEmailHint}</span>
            </span>
            <input
              name="aliasEmail"
              type="email"
              defaultValue={member?.aliasEmail ?? ""}
              placeholder={t.admin.members.aliasEmailPlaceholder}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">
                {t.admin.members.roleLabel}
              </span>
              <select
                name="role"
                defaultValue={normalizeRole(member?.role) ?? DEFAULT_ROLE}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="block">
              <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-brand-gray">
                {t.admin.members.statusLabel}
              </span>
              <select
                name="active"
                defaultValue={String(member?.active ?? true)}
                className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
              >
                <option value="true">{t.admin.members.statusActive}</option>
                <option value="false">{t.admin.members.statusInactive}</option>
              </select>
            </label>
          </div>
        </div>
        {offlineOption && (
          <label className="flex items-start gap-2 text-[13px] text-brand-near-black">
            <input
              name="paysOffline"
              type="checkbox"
              defaultChecked={member?.paysOffline ?? false}
              className="mt-[2px] accent-primary"
            />
            <span>
              <span className="font-semibold">{t.admin.members.paysOfflineLabel}</span>
              <span className="block text-label text-muted">{t.admin.members.paysOfflineHint}</span>
            </span>
          </label>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-primary py-2 text-[13px] font-bold text-on-primary disabled:opacity-60"
      >
        {isPending ? t.admin.common.saving : isEdit ? t.admin.members.submitEdit : t.admin.members.submitAdd}
      </button>
    </form>
  );
}

// ── Member list ───────────────────────────────────────────────────────────────

export function SociList({
  members,
  offlineOption = false,
  duplicates = [],
}: {
  members: Member[];
  offlineOption?: boolean;
  // Possible duplicate accounts (lib/members/duplicates.ts).
  duplicates?: ReadonlyArray<DuplicatePair>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [deletingId, startDeleteTransition] = useTransition();
  const [inviting, startInviteTransition] = useTransition();
  const [mergeRequest, setMergeRequest] = useState<MergeRequest | null>(null);
  const [unlinking, startUnlinkTransition] = useTransition();
  // Accounts already absorbed take no part in another merge.
  const mergeable = members
    .filter((m) => !m.mergedIntoName)
    .map((m) => ({ memberId: m.memberId, fullName: m.fullName, email: m.email, active: m.active, balance: m.balance ?? 0 }));

  // Below lg the secondary actions of a member, in a sheet.
  const [actionsFor, setActionsFor] = useState<Member | null>(null);
  const canMerge = (m: Member) => !m.mergedIntoName && !m.householdOfName && !m.familyNames;

  function requestMerge(request: MergeRequest) {
    setEditingId(null);
    setMergeRequest(request);
  }

  function handleInvite(m: Member) {
    startInviteTransition(async () => {
      const result = await adminInviteMember(m.memberId);
      if (result.error) toast.error(result.error);
      else toast.success(t.admin.members.inviteSent(m.fullName));
    });
  }

  // The sheet closes first, so a confirm or the merge dialog opens on its own.
  function runAction(action: () => void) {
    setActionsFor(null);
    setTimeout(action);
  }

  const query = filter.toLowerCase().trim();
  const visible = query
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query) ||
          (m.aliasEmail?.toLowerCase().includes(query) ?? false),
      )
    : members;

  // Legacy values are grouped under their canonical role; an unknown value
  // falls into the least-privileged group so the member stays visible.
  const inGroup = (role: Role) =>
    visible.filter((m) => (normalizeRole(m.role) ?? DEFAULT_ROLE) === role);

  async function handleUnlink(m: Member) {
    const ok = await confirm({
      title: t.admin.members.familyUnlinkTitle(m.fullName),
      message: t.admin.members.familyUnlinkMessage,
      confirmLabel: t.admin.members.familyUnlink,
      danger: true,
    });
    if (!ok) return;
    startUnlinkTransition(async () => {
      const result = await adminUnlinkFamilyMember(m.memberId);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  async function handleDelete(m: Member) {
    if (!(await confirm({ title: t.admin.members.deleteConfirm(m.fullName), danger: true })))
      return;
    startDeleteTransition(async () => {
      const result = await adminDeleteMember(m.memberId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(t.admin.members.deleted(m.fullName));
      }
    });
  }

  function renderGroup(label: string, list: Member[], roleColor: string) {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-1 px-1 font-mono text-label uppercase tracking-wider text-muted">
          {label} ({list.length})
        </p>
        <div className="divide-y divide-brand-border rounded-xl border border-brand-border bg-white shadow-sm">
          {list.map((m) =>
            editingId === m.memberId ? (
              <div key={m.memberId} className="p-4">
                <SociForm
                  member={m}
                  onClose={() => setEditingId(null)}
                  offlineOption={offlineOption}
                  onMergeRequest={requestMerge}
                />
              </div>
            ) : (
              // Stacked on phones, one row from sm. Emails show only in the
              // edit form: a long address cannot wrap and ran under the buttons.
              // Ordini and Modifica are always in view; the other actions sit
              // beside them from lg and behind ⋯ (a sheet) below it, so the
              // actions never wrap to a second line.
              <div
                key={m.memberId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-[14px] font-medium text-brand-near-black">{m.fullName}</span>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-label font-semibold ${roleColor}`}>
                      {getRoleLabel(m.role)}
                    </span>
                    {!m.active && (
                      <span className="rounded-full bg-brand-red-light px-1.5 py-0.5 text-label font-bold text-brand-red">
                        {t.admin.members.inactiveBadge}
                      </span>
                    )}
                    {offlineOption && m.paysOffline && (
                      <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-label font-bold text-primary-text">
                        {t.admin.members.paysOfflineBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-label text-muted">
                    {m.lastLoginAt ? t.admin.members.lastLogin(formatDate(m.lastLoginAt)) : t.admin.members.neverLoggedIn}
                  </div>
                  {m.mergedIntoName && (
                    <div className="mt-0.5 text-label text-brand-gray">{t.admin.members.merge.mergedBadge(m.mergedIntoName)}</div>
                  )}
                  {(m.householdOfName || m.familyNames) && (
                    <div className="mt-0.5 text-label font-medium text-accent-text">
                      {t.admin.members.familyBadge((m.householdOfName ?? m.familyNames)!)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={adminHref("soci", null, { member: m.memberId })}
                    aria-label={t.admin.members.ordersAria(m.fullName)}
                    className="hit-44 inline-flex min-h-9 whitespace-nowrap rounded-full border border-brand-border px-3 py-1.5 text-label font-semibold items-center text-brand-near-black"
                  >
                    {t.admin.members.ordersLink}
                  </Link>
                  <button onClick={() => setEditingId(m.memberId)} className="hit-44 min-h-9 whitespace-nowrap rounded-full border border-brand-border px-3 py-1.5 text-label font-semibold text-brand-near-black">
                    {t.admin.common.edit}
                  </button>
                  <div className="hidden items-center gap-2 lg:flex">
                    {m.active && (
                      <button
                        onClick={() => handleInvite(m)}
                        disabled={inviting}
                        className="min-h-9 whitespace-nowrap rounded-full border border-brand-border px-3 py-1.5 text-label font-semibold text-accent-text disabled:opacity-40"
                      >
                        {t.admin.members.invite}
                      </button>
                    )}
                    {m.householdOfName && (
                      <button
                        onClick={() => handleUnlink(m)}
                        disabled={unlinking}
                        className="min-h-9 whitespace-nowrap rounded-full border border-brand-border px-3 py-1.5 text-label font-semibold text-brand-gray disabled:opacity-40"
                      >
                        {t.admin.members.familyUnlink}
                      </button>
                    )}
                    {canMerge(m) && (
                      <button onClick={() => requestMerge({ absorbedId: m.memberId })} className="min-h-9 whitespace-nowrap rounded-full border border-brand-border px-3 py-1.5 text-label font-semibold text-brand-gray">
                        {t.admin.members.merge.button}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId}
                      aria-label={t.admin.members.deleteAria(m.fullName)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-red/30 text-label font-semibold text-brand-red disabled:opacity-40"
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setActionsFor(m)}
                    aria-label={t.admin.members.moreAria(m.fullName)}
                    aria-haspopup="dialog"
                    className="hit-44 flex h-9 w-9 items-center justify-center rounded-full border border-brand-border text-[16px] leading-none text-brand-near-black lg:hidden"
                  >
                    <span aria-hidden>⋯</span>
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <input
          type="search"
          placeholder={t.admin.members.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-[13px] text-brand-near-black placeholder:text-muted"
        />
      </div>
      <DuplicateMembers
        pairs={duplicates}
        members={members}
        onMerge={(p) => requestMerge({ absorbedId: p.absorbedId, survivorId: p.survivorId })}
      />
      {renderGroup(t.roles.admin, inGroup("admin"), "bg-primary-soft text-primary-text")}
      {renderGroup(t.roles.attivi, inGroup("attivi"), "bg-accent-soft text-accent-text")}
      {renderGroup(t.roles.utenti, inGroup("utenti"), "bg-black/[0.05] text-brand-gray")}
      {visible.length === 0 && (
        <div className="py-6 text-center text-[12px] text-brand-gray">{t.admin.common.noResults}</div>
      )}
      <Sheet
        open={actionsFor !== null}
        onRequestClose={() => setActionsFor(null)}
        size="sm"
        title={actionsFor?.fullName}
        subtitle={actionsFor ? getRoleLabel(actionsFor.role) : undefined}
      >
        {actionsFor && (
          <div className="divide-y divide-brand-border pb-[env(safe-area-inset-bottom)]">
            {actionsFor.active && (
              <SheetAction onClick={() => runAction(() => handleInvite(actionsFor))} className="text-accent-text">
                {t.admin.members.invite}
              </SheetAction>
            )}
            {actionsFor.householdOfName && (
              <SheetAction onClick={() => runAction(() => handleUnlink(actionsFor))}>{t.admin.members.familyUnlink}</SheetAction>
            )}
            {canMerge(actionsFor) && (
              <SheetAction onClick={() => runAction(() => requestMerge({ absorbedId: actionsFor.memberId }))}>
                {t.admin.members.merge.button}
              </SheetAction>
            )}
            <SheetAction onClick={() => runAction(() => handleDelete(actionsFor))} className="text-brand-red">
              {t.admin.members.deleteAction}
            </SheetAction>
          </div>
        )}
      </Sheet>
      {mergeRequest && (
        <MergeMembersDialog
          key={`${mergeRequest.absorbedId}:${mergeRequest.survivorId ?? ""}`}
          open
          onOpenChange={(next) => {
            if (!next) setMergeRequest(null);
          }}
          members={mergeable}
          absorbedId={mergeRequest.absorbedId}
          survivorId={mergeRequest.survivorId}
        />
      )}
    </div>
  );
}

function SheetAction({ onClick, className = "text-brand-near-black", children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center px-1 text-left text-[15px] font-semibold ${className}`}>
      {children}
    </button>
  );
}

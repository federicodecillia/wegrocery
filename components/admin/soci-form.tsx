"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { adminDeleteMember, adminInviteMember, adminUpsertMember, type UpsertMemberInput } from "@/lib/actions/admin";
import { adminUnlinkFamilyMember } from "@/lib/actions/family";
import { formatDate } from "@/lib/utils";
import { DEFAULT_ROLE, ROLES, getRoleLabel, normalizeRole, type Role } from "@/lib/roles";
import { t } from "@/lib/i18n";
import type { DuplicatePair } from "@/lib/members/duplicates";
import { DuplicateMembers } from "./duplicate-members";
import { MergeMembersDialog } from "./merge-members-dialog";

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
        onClose?.();
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
        {isEdit && onClose && (
          <button type="button" onClick={onClose} className="text-label text-brand-gray">
            ✕ {t.admin.common.cancel}
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
            {t.admin.members.nameLabel}
          </label>
          <input
            name="fullName"
            required
            defaultValue={member?.fullName}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
            {t.admin.members.emailLabel}
          </label>
          <input
            name="email"
            type="email"
            required
            defaultValue={member?.email}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
            {t.admin.members.aliasEmailLabel}
            <span className="ml-1 font-normal normal-case text-muted">{t.admin.members.aliasEmailHint}</span>
          </label>
          <input
            name="aliasEmail"
            type="email"
            defaultValue={member?.aliasEmail ?? ""}
            placeholder={t.admin.members.aliasEmailPlaceholder}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
              {t.admin.members.roleLabel}
            </label>
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
          </div>
          <div>
            <label className="mb-1 block text-label font-semibold uppercase tracking-wide text-brand-gray">
              {t.admin.members.statusLabel}
            </label>
            <select
              name="active"
              defaultValue={String(member?.active ?? true)}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black"
            >
              <option value="true">{t.admin.members.statusActive}</option>
              <option value="false">{t.admin.members.statusInactive}</option>
            </select>
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
              <div
                key={m.memberId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-[13px] font-medium text-brand-near-black">{m.fullName}</span>
                    {!m.active && (
                      <span className="rounded-full bg-brand-red-light px-1.5 py-0.5 text-label font-bold text-brand-red">
                        {t.admin.members.inactiveBadge}
                      </span>
                    )}
                    {m.mergedIntoName && (
                      <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-label font-bold text-brand-gray">
                        {t.admin.members.merge.mergedBadge(m.mergedIntoName)}
                      </span>
                    )}
                    {(m.householdOfName || m.familyNames) && (
                      <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-label font-bold text-accent-text">
                        {t.admin.members.familyBadge((m.householdOfName ?? m.familyNames)!)}
                      </span>
                    )}
                    {offlineOption && m.paysOffline && (
                      <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-label font-bold text-primary-text">
                        {t.admin.members.paysOfflineBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-label text-muted">
                    {m.lastLoginAt ? t.admin.members.lastLogin(formatDate(m.lastLoginAt)) : t.admin.members.neverLoggedIn}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-label font-semibold ${roleColor}`}>
                    {getRoleLabel(m.role)}
                  </span>
                  {m.active && (
                    <button
                      onClick={() => handleInvite(m)}
                      disabled={inviting}
                      className="whitespace-nowrap rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-accent-text disabled:opacity-40"
                    >
                      {t.admin.members.invite}
                    </button>
                  )}
                  {m.householdOfName && (
                    <button
                      onClick={() => handleUnlink(m)}
                      disabled={unlinking}
                      className="whitespace-nowrap rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-brand-gray disabled:opacity-40"
                    >
                      {t.admin.members.familyUnlink}
                    </button>
                  )}
                  {!m.mergedIntoName && !m.householdOfName && !m.familyNames && (
                    <button
                      onClick={() => requestMerge({ absorbedId: m.memberId })}
                      className="whitespace-nowrap rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-brand-gray"
                    >
                      {t.admin.members.merge.button}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(m.memberId)}
                    className="whitespace-nowrap rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-brand-gray"
                  >
                    {t.admin.common.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deletingId}
                    className="rounded-full border border-brand-red/30 px-2.5 py-1 text-label font-semibold text-brand-red disabled:opacity-40"
                  >
                    ✕
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

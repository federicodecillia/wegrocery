"use client";

import { Ellipsis, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { nameNeedsCompleting } from "@/lib/members/name";

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
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-bold text-foreground">
          {isEdit ? t.admin.members.editMember(member.fullName) : t.admin.members.addMember}
        </p>
        {close && (
          <button type="button" onClick={close} className="inline-flex items-center gap-1 text-label text-secondary-foreground">
            <X aria-hidden className="size-3.5" />
            {t.admin.common.cancel}
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground">
              {t.admin.members.nameLabel}
            </span>
            <Input
              name="fullName"
              required
              defaultValue={member?.fullName}
            />
          </label>
        </div>
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground">
              {t.admin.members.emailLabel}
            </span>
            <Input
              name="email"
              type="email"
              required
              defaultValue={member?.email}
            />
          </label>
        </div>
        <div>
          <label className="block">
            <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground">
              {t.admin.members.aliasEmailLabel}
              <span className="ml-1 font-normal normal-case text-muted-foreground">{t.admin.members.aliasEmailHint}</span>
            </span>
            <Input
              name="aliasEmail"
              type="email"
              defaultValue={member?.aliasEmail ?? ""}
              placeholder={t.admin.members.aliasEmailPlaceholder}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block">
              <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground">
                {t.admin.members.roleLabel}
              </span>
              <NativeSelect
                name="role"
                defaultValue={normalizeRole(member?.role) ?? DEFAULT_ROLE}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div>
            <label className="block">
              <span className="block mb-1 text-label font-semibold uppercase tracking-wide text-secondary-foreground">
                {t.admin.members.statusLabel}
              </span>
              <NativeSelect
                name="active"
                defaultValue={String(member?.active ?? true)}
              >
                <option value="true">{t.admin.members.statusActive}</option>
                <option value="false">{t.admin.members.statusInactive}</option>
              </NativeSelect>
            </label>
          </div>
        </div>
        {offlineOption && (
          <label className="flex items-start gap-2 text-[13px] text-foreground">
            <input
              name="paysOffline"
              type="checkbox"
              defaultChecked={member?.paysOffline ?? false}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-semibold">{t.admin.members.paysOfflineLabel}</span>
              <span className="block text-label text-muted-foreground">{t.admin.members.paysOfflineHint}</span>
            </span>
          </label>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-primary py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
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
  // Members still named after their address (lib/members/name.ts); absorbed
  // accounts keep a placeholder address and never sign in again.
  const [onlyUnnamed, setOnlyUnnamed] = useState(false);
  const needsName = (m: Member) => !m.mergedIntoName && nameNeedsCompleting(m.fullName, [m.email, m.aliasEmail]);
  const unnamedCount = members.filter(needsName).length;
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
  const showUnnamed = onlyUnnamed && unnamedCount > 0;
  const visible = members.filter(
    (m) =>
      (!showUnnamed || needsName(m)) &&
      (!query ||
        m.fullName.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        (m.aliasEmail?.toLowerCase().includes(query) ?? false)),
  );

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
        <p className="mb-1 px-1 font-mono text-label uppercase tracking-wider text-muted-foreground">
          {label} ({list.length})
        </p>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
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
                    <span className="break-words text-[14px] font-medium text-foreground">{m.fullName}</span>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-label font-semibold ${roleColor}`}>
                      {getRoleLabel(m.role)}
                    </span>
                    {needsName(m) && (
                      <span className="rounded-full bg-tint/[0.05] px-1.5 py-0.5 text-label font-semibold text-secondary-foreground">
                        {t.admin.members.nameToComplete}
                      </span>
                    )}
                    {!m.active && (
                      <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-label font-bold text-destructive">
                        {t.admin.members.inactiveBadge}
                      </span>
                    )}
                    {offlineOption && m.paysOffline && (
                      <span className="rounded-full bg-primary-bg px-1.5 py-0.5 text-label font-bold text-primary-text">
                        {t.admin.members.paysOfflineBadge}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-label text-muted-foreground">
                    {m.lastLoginAt ? t.admin.members.lastLogin(formatDate(m.lastLoginAt)) : t.admin.members.neverLoggedIn}
                  </div>
                  {m.mergedIntoName && (
                    <div className="mt-0.5 text-label text-secondary-foreground">{t.admin.members.merge.mergedBadge(m.mergedIntoName)}</div>
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
                    className="hit-44 inline-flex min-h-(--control-h) whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-label font-semibold items-center text-foreground"
                  >
                    {t.admin.members.ordersLink}
                  </Link>
                  <button onClick={() => setEditingId(m.memberId)} className="hit-44 min-h-(--control-h) whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-label font-semibold text-foreground">
                    {t.admin.common.edit}
                  </button>
                  <div className="hidden items-center gap-2 lg:flex">
                    {m.active && (
                      <button
                        onClick={() => handleInvite(m)}
                        disabled={inviting}
                        className="min-h-(--control-h) whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-label font-semibold text-accent-text disabled:opacity-40"
                      >
                        {t.admin.members.invite}
                      </button>
                    )}
                    {m.householdOfName && (
                      <button
                        onClick={() => handleUnlink(m)}
                        disabled={unlinking}
                        className="min-h-(--control-h) whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-label font-semibold text-secondary-foreground disabled:opacity-40"
                      >
                        {t.admin.members.familyUnlink}
                      </button>
                    )}
                    {canMerge(m) && (
                      <button onClick={() => requestMerge({ absorbedId: m.memberId })} className="min-h-(--control-h) whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-label font-semibold text-secondary-foreground">
                        {t.admin.members.merge.button}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId}
                      aria-label={t.admin.members.deleteAria(m.fullName)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-destructive/30 text-label font-semibold text-destructive disabled:opacity-40"
                    >
<X aria-hidden className="size-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setActionsFor(m)}
                    aria-label={t.admin.members.moreAria(m.fullName)}
                    aria-haspopup="dialog"
                    className="hit-44 flex size-(--control-h) items-center justify-center rounded-full border border-border text-[16px] leading-none text-foreground lg:hidden"
                  >
<Ellipsis aria-hidden className="size-4" />
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
        <Input
          type="search"
          placeholder={t.admin.members.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl px-4 py-2.5"
        />
        {unnamedCount > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              aria-pressed={showUnnamed}
              onClick={() => setOnlyUnnamed((v) => !v)}
              className={`hit-44 min-h-(--control-h) rounded-full border px-3 py-1.5 text-label font-semibold ${
                showUnnamed ? "border-primary bg-primary-bg text-primary-text" : "border-border text-foreground"
              }`}
            >
              {t.admin.members.nameToCompleteFilter(unnamedCount)}
            </button>
            <span className="text-label text-secondary-foreground">{t.admin.members.nameToCompleteHint}</span>
          </div>
        )}
      </div>
      <DuplicateMembers
        pairs={duplicates}
        members={members}
        onMerge={(p) => requestMerge({ absorbedId: p.absorbedId, survivorId: p.survivorId })}
      />
      {renderGroup(t.roles.admin, inGroup("admin"), "bg-primary-bg text-primary-text")}
      {renderGroup(t.roles.attivi, inGroup("attivi"), "bg-accent-bg text-accent-text")}
      {renderGroup(t.roles.utenti, inGroup("utenti"), "bg-tint/[0.05] text-secondary-foreground")}
      {visible.length === 0 && (
        <div className="py-6 text-center text-[12px] text-secondary-foreground">{t.admin.common.noResults}</div>
      )}
      <Sheet
        open={actionsFor !== null}
        onRequestClose={() => setActionsFor(null)}
        size="sm"
        title={actionsFor?.fullName}
        subtitle={actionsFor ? getRoleLabel(actionsFor.role) : undefined}
      >
        {actionsFor && (
          <div className="divide-y divide-border pb-[env(safe-area-inset-bottom)]">
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
            <SheetAction onClick={() => runAction(() => handleDelete(actionsFor))} className="text-destructive">
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

function SheetAction({ onClick, className = "text-foreground", children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center px-1 text-left text-[15px] font-semibold ${className}`}>
      {children}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { adminDeleteMember, adminInviteMember, adminUpsertMember, type UpsertMemberInput } from "@/lib/actions/admin";
import { formatDate } from "@/lib/utils";
import { DEFAULT_ROLE, ROLES, getRoleLabel, normalizeRole, type Role } from "@/lib/roles";
import { t } from "@/lib/i18n";

type Member = {
  memberId: string;
  fullName: string;
  email: string;
  aliasEmail: string | null;
  role: string;
  active: boolean;
  lastLoginAt?: string | null;
};

export function SociForm({ member, onClose }: { member?: Member; onClose?: () => void }) {
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
    };
    startTransition(async () => {
      try {
        const result = await adminUpsertMember(data);
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
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
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
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
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
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-[13px] text-brand-near-black focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="true">{t.admin.members.statusActive}</option>
              <option value="false">{t.admin.members.statusInactive}</option>
            </select>
          </div>
        </div>
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

export function SociList({ members }: { members: Member[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [deletingId, startDeleteTransition] = useTransition();
  const [inviting, startInviteTransition] = useTransition();

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
          m.fullName.toLowerCase().includes(query) || m.email.toLowerCase().includes(query),
      )
    : members;

  // Legacy values are grouped under their canonical role; an unknown value
  // falls into the least-privileged group so the member stays visible.
  const inGroup = (role: Role) =>
    visible.filter((m) => (normalizeRole(m.role) ?? DEFAULT_ROLE) === role);

  function handleDelete(m: Member) {
    if (!window.confirm(t.admin.members.deleteConfirm(m.fullName)))
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
                <SociForm member={m} onClose={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={m.memberId} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-brand-near-black">{m.fullName}</span>
                    {!m.active && (
                      <span className="rounded-full bg-brand-red-light px-1.5 py-0.5 text-label font-bold text-brand-red">
                        {t.admin.members.inactiveBadge}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-label text-muted">
                    {m.email}
                    {m.aliasEmail && (
                      <span className="ml-1 text-accent-text">· {m.aliasEmail}</span>
                    )}
                  </div>
                  <div className="text-label text-muted">
                    {m.lastLoginAt ? t.admin.members.lastLogin(formatDate(m.lastLoginAt)) : t.admin.members.neverLoggedIn}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-label font-semibold ${roleColor}`}>
                    {getRoleLabel(m.role)}
                  </span>
                  {m.active && (
                    <button
                      onClick={() => handleInvite(m)}
                      disabled={inviting}
                      className="rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-accent-text disabled:opacity-40"
                    >
                      {t.admin.members.invite}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(m.memberId)}
                    className="rounded-full border border-brand-border px-2.5 py-1 text-label font-semibold text-brand-gray"
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
          className="w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-[13px] text-brand-near-black placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {renderGroup(t.roles.admin, inGroup("admin"), "bg-primary-soft text-primary-text")}
      {renderGroup(t.roles.attivi, inGroup("attivi"), "bg-accent-soft text-accent-text")}
      {renderGroup(t.roles.utenti, inGroup("utenti"), "bg-black/[0.05] text-brand-gray")}
      {visible.length === 0 && (
        <div className="py-6 text-center text-[12px] text-brand-gray">{t.admin.common.noResults}</div>
      )}
    </div>
  );
}

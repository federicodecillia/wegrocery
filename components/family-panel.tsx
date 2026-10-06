"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  acceptFamilyInvite,
  cancelFamilyInvite,
  declineFamilyInvite,
  inviteToFamily,
  leaveFamily,
  removeFromFamily,
} from "@/lib/actions/family";
import { t } from "@/lib/i18n";

type Props = {
  enabled: boolean;
  personId: string;
  // The signed-in person is the account's own (not someone who joined it).
  isOwner: boolean;
  people: { memberId: string; fullName: string; email: string }[];
  sent: { inviteId: string; name: string; email: string }[];
  received: { inviteId: string; accountName: string; expires: string }[];
  // The person's own balance, formatted; null when zero.
  balance: string | null;
};

const card = "mb-[14px] overflow-hidden rounded-[18px] border border-brand-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const heading = "px-4 pt-[14px] font-mono text-label font-bold uppercase tracking-widest text-brand-gray";

export function FamilyPanel({ enabled, personId, isOwner, people, sent, received, balance }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const inFamily = people.length > 1;

  function run(action: () => Promise<{ error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      after?.();
      router.refresh();
    });
  }

  async function accept(inviteId: string, accountName: string) {
    const ok = await confirm({
      title: t.family.acceptTitle,
      message: t.family.acceptMessage(accountName, balance),
      confirmLabel: t.family.accept,
    });
    if (ok) run(() => acceptFamilyInvite(inviteId));
  }

  async function leave() {
    const ok = await confirm({
      title: t.family.leaveTitle,
      message: t.family.leaveMessage,
      confirmLabel: t.family.leave,
      danger: true,
    });
    if (ok) run(() => leaveFamily());
  }

  async function remove(memberId: string, name: string) {
    const ok = await confirm({
      title: t.family.removeTitle(name),
      message: t.family.removeMessage,
      confirmLabel: t.family.remove,
      danger: true,
    });
    if (ok) run(() => removeFromFamily(memberId));
  }

  if (!enabled && !inFamily) {
    return <p className="text-[14px] leading-snug text-brand-gray">{t.family.disabled}</p>;
  }

  return (
    <>
      {received.length > 0 && (
        <div className={card}>
          <div className={heading}>{t.family.received}</div>
          {received.map((i) => (
            <div key={i.inviteId} className="border-b border-brand-border px-4 py-[14px] last:border-b-0">
              <div className="text-[14px] font-bold text-brand-near-black">{t.family.invitedBy(i.accountName)}</div>
              <div className="mt-[3px] text-[12px] text-brand-gray">{t.family.expires(i.expires)}</div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="teal" disabled={isPending} onClick={() => accept(i.inviteId, i.accountName)}>
                  {t.family.accept}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => declineFamilyInvite(i.inviteId))}
                >
                  {t.family.decline}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <div className={heading}>{t.family.people}</div>
        {people.map((p) => (
          <div
            key={p.memberId}
            className="flex items-center gap-3 border-b border-brand-border px-4 py-[14px] last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-brand-near-black">
                {p.fullName}
                {p.memberId === personId && <span className="font-normal text-muted"> ({t.family.you})</span>}
              </div>
              <div className="mt-[3px] break-all text-[12px] text-brand-gray">{p.email}</div>
            </div>
            {isOwner && p.memberId !== personId && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => remove(p.memberId, p.fullName)}>
                {t.family.remove}
              </Button>
            )}
          </div>
        ))}
        {!inFamily && <p className="px-4 pb-[14px] text-[12px] text-brand-gray">{t.family.alone}</p>}
      </div>

      {sent.length > 0 && (
        <div className={card}>
          <div className={heading}>{t.family.pendingSent}</div>
          {sent.map((i) => (
            <div
              key={i.inviteId}
              className="flex items-center gap-3 border-b border-brand-border px-4 py-[14px] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-brand-near-black">{i.name}</div>
                <div className="mt-[3px] break-all text-[12px] text-brand-gray">{i.email}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => cancelFamilyInvite(i.inviteId))}
              >
                {t.family.cancelInvite}
              </Button>
            </div>
          ))}
        </div>
      )}

      {enabled && (
        <form
          className={`${card} px-4 py-[14px]`}
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) run(() => inviteToFamily(email), () => setEmail(""));
          }}
        >
          <div className="text-[14px] font-bold text-brand-near-black">{t.family.inviteTitle}</div>
          <p className="mt-[3px] text-[12px] leading-snug text-brand-gray">{t.family.inviteHint}</p>
          <label className="mt-3 block text-[12px] font-bold text-brand-near-black" htmlFor="family-email">
            {t.family.emailLabel}
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="family-email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-full border border-brand-border px-4 py-2 text-[14px]"
            />
            <Button type="submit" size="sm" variant="orange" disabled={isPending || !email.trim()}>
              {t.family.send}
            </Button>
          </div>
        </form>
      )}

      {inFamily && !isOwner && (
        <Button variant="outline" block disabled={isPending} onClick={leave}>
          {t.family.leave}
        </Button>
      )}
    </>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { adminApproveRequest, adminRejectRequest } from "@/lib/actions/admin-members";
import { t } from "@/lib/i18n";

export type RequestRow = {
  requestId: string;
  fullName: string;
  email: string;
  phone: string | null;
  note: string | null;
  /** Formatted on the server, in the group's time zone. */
  createdLabel: string;
};

// Soci -> Richieste in attesa ('request' sign-up mode): approve creates the
// member and sends the invitation, reject sends nothing.
export function MembershipRequests({ requests, mode }: { requests: RequestRow[]; mode: string }) {
  const s = t.admin.members.requests;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(kind: "approve" | "reject", requestId: string) {
    startTransition(async () => {
      const result = kind === "approve" ? await adminApproveRequest(requestId) : await adminRejectRequest(requestId);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
      router.refresh();
    });
  }

  const button = "min-h-11 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60";
  return (
    <section id="richieste" aria-labelledby="richieste-title" className="rounded-xl border border-border bg-card p-4">
      <h2 id="richieste-title" className="text-[15px] font-bold text-foreground">
        {s.title(requests.length)}
      </h2>
      {mode !== "request" ? <p className="mt-1 text-[12px] text-secondary-foreground">{s.modeOff}</p> : null}
      {requests.length === 0 ? (
        <p className="mt-2 text-[13px] text-secondary-foreground">{s.empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {requests.map((r) => (
            <li key={r.requestId} className="py-3 first:pt-0 last:pb-0">
              <p className="text-[14px] font-semibold text-foreground">{r.fullName}</p>
              <p className="break-all text-[13px] text-secondary-foreground">{r.email}</p>
              {r.phone ? <p className="text-[13px] text-secondary-foreground">{r.phone}</p> : null}
              {r.note ? <p className="mt-1 whitespace-pre-line text-[13px] text-foreground">{r.note}</p> : null}
              <p className="mt-1 text-[12px] text-secondary-foreground">{s.sentAt(r.createdLabel)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run("approve", r.requestId)}
                  className={`${button} bg-primary text-primary-foreground`}
                  aria-label={s.approveAria(r.fullName)}
                >
                  {s.approve}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run("reject", r.requestId)}
                  className={`${button} border border-border text-foreground`}
                  aria-label={s.rejectAria(r.fullName)}
                >
                  {s.reject}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

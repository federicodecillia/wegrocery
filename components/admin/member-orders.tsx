import Link from "next/link";
import { getAdminMemberOrders, getAllMembers } from "@/lib/db/queries";
import { formatDate, formatEur, getProductEmoji } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { adminHref } from "@/lib/admin/nav";

// Admin → Soci → a member's orders, every cycle, newest first (it was the
// member filter of the old Ordini tab), with a way to their movements in Cassa.
export async function MemberOrders({ memberId }: { memberId: string }) {
  const [members, orders] = await Promise.all([getAllMembers(), getAdminMemberOrders(memberId)]);
  const member = members.find((m) => m.memberId === memberId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={adminHref("soci")}
          className="inline-flex min-h-10 items-center text-[13px] font-semibold text-primary-text"
        >
          {t.admin.members.backToMembers}
        </Link>
        {member && (
          <Link
            href={adminHref("cassa", null, { member: memberId })}
            className="inline-flex min-h-10 items-center rounded-xl border border-brand-border bg-white px-3 text-[13px] font-semibold text-brand-near-black"
          >
            {t.admin.members.seeMovements}
          </Link>
        )}
      </div>
      {member && (
        <div className="rounded-xl border border-brand-border bg-white px-4 py-3 shadow-sm">
          <h2 className="text-[15px] font-bold text-brand-near-black">{member.fullName}</h2>
          <div className="mt-0.5 font-mono text-label text-muted">
            {member.email} ·{" "}
            {t.admin.orders.memberSummary(orders.length, formatEur(orders.reduce((s, o) => s + o.total, 0)))}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border p-6 text-center text-[13px] text-brand-gray">
          {t.admin.orders.noMemberOrders}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((cycle) => (
            <Card key={cycle.cycleId}>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <Link
                    href={adminHref("ciclo", "ordini", { cycle: cycle.cycleId })}
                    className="text-[13px] font-bold text-brand-near-black underline-offset-2 hover:underline"
                  >
                    {cycle.cycleTitle}
                  </Link>
                  {cycle.pickupDate && (
                    <div className="mt-0.5 font-mono text-label text-muted">
                      {t.admin.orders.pickupLabel} {formatDate(cycle.pickupDate)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-label font-bold ${
                      cycle.cycleStatus === "open"
                        ? "bg-accent-soft text-accent-text"
                        : "bg-black/[0.05] text-brand-gray"
                    }`}
                  >
                    {cycle.cycleStatus === "open" ? t.admin.orders.openBadge : t.admin.orders.closedBadge}
                  </span>
                  <span className="font-mono text-[13px] font-bold text-brand-near-black">
                    {formatEur(cycle.total)}
                  </span>
                </div>
              </CardHeader>
              <div className="divide-y divide-brand-border">
                {cycle.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] text-brand-near-black">
                      <span className="text-[16px] leading-none">{getProductEmoji(line.productName)}</span>
                      {line.productName}
                      {line.variant && (
                        <span className="text-brand-gray">· {line.variant}</span>
                      )}
                      <span className="font-mono text-label text-muted">
                        ×{line.quantity}
                      </span>
                    </span>
                    <span className="font-mono text-[12px] text-brand-near-black">
                      {formatEur(line.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

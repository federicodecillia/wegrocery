import Link from "next/link";
import {
  getAllMembers,
  getAllMembersWithBalances,
  getAdminMemberLedger,
  getMemberBalance,
} from "@/lib/db/queries";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { LedgerEntryRow, TopupForm } from "./cassa-forms";

type Props = { memberId?: string };

export async function TabCassa({ memberId }: Props) {
  const [allMembers, membersWithBalances] = await Promise.all([
    getAllMembers(),
    getAllMembersWithBalances(),
  ]);

  const topupMembers = allMembers
    .filter((m) => m.active)
    .map((m) => ({ memberId: m.memberId, fullName: m.fullName }));

  const selectedMember = memberId
    ? allMembers.find((m) => m.memberId === memberId)
    : null;

  const ledgerEntries = memberId ? await getAdminMemberLedger(memberId) : null;
  const memberBalance = memberId ? await getMemberBalance(memberId) : null;

  return (
    <div className="space-y-4">
      <TopupForm members={topupMembers} />

      {/* Balance table */}
      <Card>
        <CardHeader>
          <h3 className="text-[13px] font-bold text-pm-near-black">
            Saldi soci ({membersWithBalances.length})
          </h3>
        </CardHeader>
        <div className="divide-y divide-pm-border">
          {membersWithBalances.map((m) => (
            <div
              key={m.memberId}
              className={`flex items-center justify-between px-4 py-2.5 ${
                m.memberId === memberId ? "bg-pm-orange-light" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-pm-near-black">{m.fullName}</div>
                <div className="font-mono text-[10px] text-pm-gray-light">
                  {m.role}{m.active ? "" : " · inattivo"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-[13px] font-bold ${
                    m.balance >= 0 ? "text-pm-teal" : "text-pm-red"
                  }`}
                >
                  {m.balance >= 0 ? "+" : ""}
                  {m.balance.toFixed(2).replace(".", ",")}
                </span>
                <Link
                  href={`/admin?tab=cassa&member=${m.memberId}`}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    m.memberId === memberId
                      ? "bg-pm-orange text-white"
                      : "bg-black/[0.05] text-pm-gray"
                  }`}
                >
                  {m.memberId === memberId ? "▲" : "Mov."}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Member ledger */}
      {selectedMember && ledgerEntries && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-pm-near-black">
                Movimenti: {selectedMember.fullName}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-pm-gray">
                Saldo:{" "}
                <span className={memberBalance! >= 0 ? "text-pm-teal" : "text-pm-red"}>
                  {memberBalance! >= 0 ? "+" : ""}
                  {memberBalance!.toFixed(2).replace(".", ",")}€
                </span>
              </p>
            </div>
            <Link
              href="/admin?tab=cassa"
              className="rounded-full border border-pm-border px-3 py-1 text-[11px] text-pm-gray"
            >
              Chiudi ✕
            </Link>
          </CardHeader>
          {ledgerEntries.length === 0 ? (
            <div className="p-4 text-center text-[12px] text-pm-gray">Nessun movimento</div>
          ) : (
            <div className="divide-y divide-pm-border">
              {ledgerEntries.map((entry) => (
                <div key={entry.entryId}>
                  <div className="px-4 pt-2.5 font-mono text-[10px] text-pm-gray-light">
                    {entry.entryDate ? formatDate(entry.entryDate) : "—"}
                  </div>
                  <LedgerEntryRow
                    entry={{
                      entryId: entry.entryId,
                      type: entry.type,
                      amount: entry.amount,
                      note: entry.note,
                      entryDate: entry.entryDate,
                      cycleTitle: entry.cycleTitle ?? null,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

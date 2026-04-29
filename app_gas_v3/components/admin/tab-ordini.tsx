import Link from "next/link";
import {
  getAllCycles,
  getAllMembers,
  getAdminCycleSummary,
  getAdminMemberOrders,
  getOpenCycle,
} from "@/lib/db/queries";
import { formatDate, formatEur } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CsvExportButton, OrdiniByMember } from "./ordini-client";

type Props = { cycleId?: string; memberId?: string };

export async function TabOrdini({ cycleId, memberId }: Props) {
  const [openCycle, allCycles, allMembers] = await Promise.all([
    getOpenCycle(),
    getAllCycles(20),
    getAllMembers(),
  ]);

  // ── Member view ───────────────────────────────────────────────────
  if (memberId) {
    const selectedMember = allMembers.find((m) => m.memberId === memberId);
    const orders = await getAdminMemberOrders(memberId);

    return (
      <div className="space-y-4">
        {/* Member selector row */}
        <MemberSelector allMembers={allMembers} currentMemberId={memberId} />

        {selectedMember && (
          <div className="rounded-xl border border-pm-border bg-white px-4 py-3 shadow-sm">
            <div className="text-[13px] font-bold text-pm-near-black">{selectedMember.fullName}</div>
            <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
              {selectedMember.email} · {orders.length} cicl{orders.length === 1 ? "o" : "i"} ·{" "}
              {formatEur(orders.reduce((s, o) => s + o.total, 0))} totale
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-pm-border p-6 text-center text-[13px] text-pm-gray">
            Nessun ordine registrato.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((cycle) => (
              <Card key={cycle.cycleId}>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-pm-near-black">{cycle.cycleTitle}</div>
                    {cycle.pickupDate && (
                      <div className="mt-0.5 font-mono text-[10px] text-pm-gray-light">
                        Ritiro: {formatDate(cycle.pickupDate)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        cycle.cycleStatus === "open"
                          ? "bg-pm-teal-light text-pm-teal"
                          : "bg-black/[0.05] text-pm-gray"
                      }`}
                    >
                      {cycle.cycleStatus === "open" ? "Aperto" : "Chiuso"}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-pm-near-black">
                      {formatEur(cycle.total)}
                    </span>
                  </div>
                </CardHeader>
                <div className="divide-y divide-pm-border">
                  {cycle.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[13px] text-pm-near-black">
                        {line.productName}
                        {line.variant && (
                          <span className="ml-1 text-pm-gray">· {line.variant}</span>
                        )}
                        <span className="ml-2 font-mono text-[11px] text-pm-gray-light">
                          ×{line.quantity}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] text-pm-near-black">
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

  // ── Cycle view (default) ─────────────────────────────────────────
  const selectedId = cycleId ?? openCycle?.cycleId ?? allCycles[0]?.cycleId;

  if (!selectedId) {
    return (
      <div className="space-y-4">
        <MemberSelector allMembers={allMembers} currentMemberId={undefined} />
        <div className="rounded-xl border border-dashed border-pm-border p-8 text-center text-[13px] text-pm-gray">
          Nessun ciclo disponibile.
        </div>
      </div>
    );
  }

  const [summary, selectedCycle] = await Promise.all([
    getAdminCycleSummary(selectedId),
    Promise.resolve(allCycles.find((c) => c.cycleId === selectedId)),
  ]);

  return (
    <div className="space-y-4">
      {/* Member selector */}
      <MemberSelector allMembers={allMembers} currentMemberId={undefined} />

      {/* Cycle selector */}
      <div className="flex flex-wrap gap-1.5">
        {allCycles.slice(0, 8).map((c) => (
          <Link
            key={c.cycleId}
            href={`/admin?tab=ordini&cycle=${c.cycleId}`}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
              c.cycleId === selectedId
                ? "bg-pm-orange text-white"
                : "bg-black/[0.05] text-pm-gray"
            }`}
          >
            {c.title}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-pm-orange-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-pm-gray">Soci</div>
          <div className="text-[24px] font-bold text-pm-near-black">{summary.orderCount}</div>
        </div>
        <div className="rounded-xl bg-pm-teal-light px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-pm-gray">Totale</div>
          <div className="text-[24px] font-bold text-pm-near-black">
            {formatEur(summary.grandTotal)}
          </div>
        </div>
      </div>

      {summary.orderCount === 0 ? (
        <div className="rounded-xl border border-dashed border-pm-border p-6 text-center text-[13px] text-pm-gray">
          Nessun ordine per questo ciclo.
        </div>
      ) : (
        <>
          {/* By product */}
          <Card>
            <CardHeader>
              <h3 className="text-[13px] font-bold text-pm-near-black">Per prodotto</h3>
            </CardHeader>
            <div className="divide-y divide-pm-border">
              {summary.byProduct.map((p) => (
                <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-[13px] font-medium text-pm-near-black">{p.name}</span>
                    {p.variant && (
                      <span className="ml-1.5 text-[12px] text-pm-gray">{p.variant}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-pm-gray">×{p.totalQty}</span>
                    <span className="font-mono text-[13px] font-bold text-pm-near-black">
                      {formatEur(p.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <CardBody className="border-t border-pm-border py-2.5">
              <div className="flex justify-between text-[13px] font-bold text-pm-near-black">
                <span>Totale</span>
                <span className="font-mono">{formatEur(summary.grandTotal)}</span>
              </div>
            </CardBody>
          </Card>

          {/* By member */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-pm-near-black">Per socio</h3>
              <CsvExportButton summary={summary} cycleTitle={selectedCycle?.title ?? selectedId} />
            </CardHeader>
            <OrdiniByMember byMember={summary.byMember} />
          </Card>
        </>
      )}
    </div>
  );
}

// ── Member selector ────────────────────────────────────────────────────────────

function MemberSelector({
  allMembers,
  currentMemberId,
}: {
  allMembers: { memberId: string; fullName: string }[];
  currentMemberId: string | undefined;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-pm-gray-light">
        Socio
      </span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        <Link
          href="/admin?tab=ordini"
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            !currentMemberId ? "bg-pm-orange text-white" : "bg-black/[0.05] text-pm-gray"
          }`}
        >
          Tutti
        </Link>
        {allMembers
          .filter((m) => m.memberId)
          .slice(0, 12)
          .map((m) => (
            <Link
              key={m.memberId}
              href={`/admin?tab=ordini&member=${m.memberId}`}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                m.memberId === currentMemberId
                  ? "bg-pm-orange text-white"
                  : "bg-black/[0.05] text-pm-gray"
              }`}
            >
              {m.fullName.split(" ")[0]}
            </Link>
          ))}
      </div>
    </div>
  );
}

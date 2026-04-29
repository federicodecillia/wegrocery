import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CycleCountdown } from "@/components/home/cycle-countdown";
import { getUserRole, requireUserSession } from "@/lib/auth/session";
import {
  getCycleProducts,
  getMemberBalance,
  getMemberLedger,
  getMemberOrderLines,
  getOpenCycle,
} from "@/lib/db/queries";
import { formatDateShort, formatEur, formatEurSigned, getProductEmoji } from "@/lib/utils";

export default async function HomePage() {
  const session = await requireUserSession();
  const role = getUserRole(session);
  const memberId = session.user.memberId!;

  const [balance, openCycle, recentMovements] = await Promise.all([
    getMemberBalance(memberId),
    getOpenCycle(),
    getMemberLedger(memberId, 4),
  ]);

  const canOrder =
    openCycle !== null &&
    (openCycle.accessLevel === "all" ||
      ["admin", "attivo", "member"].includes(role ?? ""));

  const [cycleProducts, myLines] = canOrder
    ? await Promise.all([
        getCycleProducts(openCycle!.cycleId),
        getMemberOrderLines(memberId, openCycle!.cycleId),
      ])
    : [[], []];

  const productMap = new Map(cycleProducts.map((p) => [p.productId, p]));
  const orderTotal = myLines.reduce((s, l) => s + parseFloat(l.lineTotal), 0);
  const afterBalance = balance - orderTotal;

  const isNegative = balance < 0;

  return (
    <AppShell email={session.user.email} isAdmin={role === "admin"}>
      {/* ── Saldo hero card ── */}
      <div
        className={`mb-[14px] rounded-[20px] p-[20px_22px_22px] ${
          isNegative
            ? "border-[1.5px] border-[#f9c8c8] bg-pm-red-light"
            : "border-[1.5px] border-pm-orange-mid bg-pm-orange-light"
        }`}
      >
        <div
          className={`mb-[10px] font-mono text-[9px] font-semibold uppercase tracking-[0.13em] ${
            isNegative ? "text-pm-red" : "text-pm-orange"
          }`}
        >
          Il tuo saldo
        </div>
        <div className="mb-[16px] flex items-baseline gap-[6px]">
          <span className="text-[28px] font-bold leading-none text-pm-near-black/25">€</span>
          <span
            className={`text-[70px] font-black leading-none tracking-[-0.045em] ${
              isNegative ? "text-pm-red" : "text-pm-near-black"
            }`}
          >
            {Math.abs(balance).toFixed(2).replace(".", ",")}
          </span>
        </div>
        <div
          className={`flex overflow-hidden rounded-[12px] ${
            isNegative ? "border border-[#f9c8c8]" : "border border-pm-orange-mid"
          }`}
        >
          <div className="flex-1 bg-white/60 p-[9px_13px]">
            <div className="mb-[3px] font-mono text-[9px] uppercase tracking-[0.07em] text-[#a07020]">
              Questo ordine
            </div>
            <div className="font-mono text-[13px] font-bold text-pm-near-black">
              {formatEur(orderTotal)}
            </div>
          </div>
          <div
            className={`flex-1 bg-white/35 p-[9px_13px] ${
              isNegative ? "border-l border-[#f9c8c8]" : "border-l border-pm-orange-mid"
            }`}
          >
            <div className="mb-[3px] font-mono text-[9px] uppercase tracking-[0.07em] text-[#a07020]">
              Dopo ordine
            </div>
            <div
              className={`font-mono text-[13px] font-bold ${
                afterBalance < 0 ? "text-pm-red" : "text-pm-near-black"
              }`}
            >
              {formatEur(afterBalance)}
              {afterBalance < 0 && " −"}
            </div>
          </div>
        </div>
        {isNegative && (
          <div className="mt-[12px]">
            <Link
              href="/storico"
              className="flex w-full items-center justify-center rounded-full bg-pm-red px-4 py-[10px] text-[13px] font-bold text-white"
            >
              Ricarica il saldo →
            </Link>
          </div>
        )}
      </div>

      {/* ── Cycle card ── */}
      {canOrder && openCycle ? (
        <CycleCountdown
          title={openCycle.title}
          orderCloseAt={(openCycle.orderCloseAt ?? new Date()).toISOString()}
          orderOpenAt={(openCycle.orderOpenAt ?? openCycle.createdAt).toISOString()}
          pickupDate={openCycle.pickupDate?.toISOString() ?? null}
        />
      ) : (
        <div className="mb-[14px] flex items-center justify-between rounded-[18px] border border-pm-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div>
            <div className="text-[15px] font-bold">Nessun ordine aperto</div>
            <div className="font-mono text-[10px] text-pm-gray-light">
              Torna quando ci sarà un nuovo ciclo
            </div>
          </div>
          <span className="rounded-full bg-black/[0.06] px-2.5 py-1 font-mono text-[10px] text-pm-gray">
            Chiuso
          </span>
        </div>
      )}

      {/* ── Order summary card ── */}
      {canOrder && openCycle && myLines.length > 0 && (
        <div className="mb-[14px] overflow-hidden rounded-[18px] border border-pm-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-pm-border px-4 py-[14px]">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-pm-gray">
              Il tuo ordine
            </span>
            <Link
              href="/ordine"
              className="rounded-full border border-pm-border px-[13px] py-[5px] font-mono text-[11px] font-bold uppercase tracking-widest text-pm-near-black"
            >
              Modifica
            </Link>
          </div>
          {myLines.map((line) => {
            const p = productMap.get(line.productId);
            const meta = [p?.variant, p?.format].filter(Boolean).join(" · ");
            return (
              <div
                key={line.orderLineId}
                className="flex items-center justify-between border-b border-pm-border px-4 py-[11px] last:border-none"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-[1px] shrink-0 text-[18px] leading-none">
                    {getProductEmoji(p?.name ?? "")}
                  </span>
                  <div>
                    <div className="text-[14px] font-medium text-pm-near-black">
                      {p?.name ?? "?"}
                    </div>
                    {meta && (
                      <div className="mt-[1px] font-mono text-[11px] text-pm-gray">{meta}</div>
                    )}
                  </div>
                </div>
                <div className="font-mono text-[13px] font-semibold text-pm-near-black">
                  ×{line.quantity} · {formatEur(parseFloat(line.lineTotal))}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-b-[18px] border-t border-pm-border bg-[#f5f1ec] px-4 py-[12px]">
            <span className="text-[13px] font-extrabold text-pm-near-black">Totale</span>
            <span className="font-mono text-[13px] font-bold text-pm-near-black">
              {formatEur(orderTotal)}
            </span>
          </div>
        </div>
      )}

      {canOrder && openCycle && myLines.length === 0 && (
        <div className="mb-[14px] flex items-center justify-between rounded-[18px] border border-pm-border bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <span className="text-[14px] text-pm-gray">Non hai ancora ordinato</span>
          <Link
            href="/ordine"
            className="rounded-full bg-pm-orange px-4 py-[10px] text-[13px] font-bold text-white"
          >
            Ordina →
          </Link>
        </div>
      )}

      {/* ── Recent movements ── */}
      {recentMovements.length > 0 && (
        <div className="mt-[4px]">
          <div className="mb-[10px] flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-pm-gray">
              Ultimi movimenti
            </span>
            <Link
              href="/storico"
              className="font-mono text-[10px] font-bold text-pm-orange"
            >
              Vedi tutto →
            </Link>
          </div>
          {recentMovements.map((e) => {
            const isPos = parseFloat(e.amount) >= 0;
            const typeLabel =
              e.type === "topup"
                ? "Bonifico"
                : e.type === "order_charge"
                  ? "Ordine"
                  : "Rettifica";
            const label = typeLabel + (e.note ? " · " + e.note : "");
            return (
              <div
                key={e.entryId}
                className="flex items-center justify-between border-b border-pm-border py-[11px] last:border-none"
              >
                <div>
                  <div className="text-[13px] font-medium text-pm-near-black">{label}</div>
                  <div className="mt-[2px] font-mono text-[10px] text-pm-gray-light">
                    {formatDateShort(e.entryDate)}
                  </div>
                </div>
                <div
                  className={`font-mono text-[13px] font-semibold ${isPos ? "text-pm-teal" : "text-pm-red"}`}
                >
                  {formatEurSigned(parseFloat(e.amount))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

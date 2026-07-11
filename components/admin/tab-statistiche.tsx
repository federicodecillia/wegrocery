import {
  getAllCycles,
  getAllMembers,
  getAllSuppliersAdmin,
  getAnalyticsOverview,
  getCycleRevenueTrend,
  getMemberParticipation,
  getProductRankings,
  getSupplierStats,
} from "@/lib/db/queries";
import { formatEur, getProductEmoji } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatsFilters } from "./statistiche-client";
import { t } from "@/lib/i18n";

type Props = {
  cycleIds?: string[];
  supplierIds?: string[];
  memberIds?: string[];
};

// Admin analytics dashboard. All charts are rendered with pure CSS and
// inline SVG — no third-party charting library — so the bundle stays
// lean and the visual style matches the rest of the app perfectly.
export async function TabStatistiche({ cycleIds, supplierIds, memberIds }: Props) {
  const filters = { cycleIds, supplierIds, memberIds };
  const [overview, products, trend, members, suppliers, allCycles, allSuppliers, allMembers] =
    await Promise.all([
      getAnalyticsOverview(filters),
      getProductRankings(10, filters),
      getCycleRevenueTrend(12, filters),
      getMemberParticipation(filters),
      getSupplierStats(filters),
      getAllCycles(50),
      getAllSuppliersAdmin(),
      getAllMembers(),
    ]);

  const filterOptions = {
    cycles: allCycles.map((c) => ({ cycleId: c.cycleId, title: c.title })),
    suppliers: allSuppliers.map((s) => ({ supplierId: s.supplierId, name: s.name })),
    members: allMembers.map((m) => ({ memberId: m.memberId, fullName: m.fullName })),
  };

  const hasFilters = Boolean(
    (cycleIds && cycleIds.length > 0) ||
      (supplierIds && supplierIds.length > 0) ||
      (memberIds && memberIds.length > 0),
  );

  // Empty-state: no closed cycles yet means there is literally nothing to
  // analyze. Still render the filter bar so the admin can clear/change it.
  if (overview.closedCycles === 0) {
    return (
      <div className="space-y-4">
        <StatsFilters {...filterOptions} />
        <Card>
          <CardBody>
            <div className="py-12 text-center">
              <div className="mb-2 text-4xl">📊</div>
              <h2 className="text-[15px] font-bold text-brand-near-black">
                {hasFilters ? t.admin.stats.noDataFiltered : t.admin.stats.noDataTitle}
              </h2>
              <p className="mt-1 text-[12px] text-brand-gray">
                {hasFilters ? t.admin.stats.noDataFilterHint : t.admin.stats.noDataHint}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsFilters {...filterOptions} />
      <OverviewCards overview={overview} />
      <ProductRankingsCard rankings={products} />
      <RevenueTrendCard trend={trend} />
      <SupplierStatsCard suppliers={suppliers} />
      <MemberParticipationCard members={members} />
    </div>
  );
}

// ── Overview top-line cards ──────────────────────────────────────────────────

function OverviewCards({
  overview,
}: {
  overview: Awaited<ReturnType<typeof getAnalyticsOverview>>;
}) {
  const cards = [
    {
      label: t.admin.stats.overviewClosedCycles,
      value: overview.closedCycles.toString(),
      icon: "🛒",
      tone: "orange" as const,
    },
    {
      label: t.admin.stats.overviewActiveMembers,
      value: overview.activeMembers.toString(),
      icon: "👥",
      tone: "teal" as const,
      hint: t.admin.stats.overviewActiveMembersHint,
    },
    {
      label: t.admin.stats.overviewTotalSpend,
      value: formatEur(overview.totalRevenue),
      icon: "💰",
      tone: "orange" as const,
      hint: t.admin.stats.overviewTotalSpendHint,
    },
    {
      label: t.admin.stats.overviewTopProduct,
      value: overview.topProductName ?? "—",
      icon: getProductEmoji(overview.topProductName ?? ""),
      tone: "teal" as const,
      hint: overview.topProductQty > 0 ? t.admin.stats.cyclesCountLabel(overview.topProductQty) : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl p-3 ${
            c.tone === "orange"
              ? "border border-brand-orange-mid bg-brand-orange-light"
              : "border border-brand-teal/20 bg-brand-teal-light"
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-brand-gray">
              {c.label}
            </span>
            <span className="text-[16px] leading-none">{c.icon}</span>
          </div>
          <div className="truncate text-[18px] font-black tracking-[-0.02em] text-brand-near-black">
            {c.value}
          </div>
          {c.hint && (
            <div className="mt-0.5 truncate font-mono text-[10px] text-brand-gray-light">
              {c.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Product rankings — horizontal CSS bar chart ──────────────────────────────

function ProductRankingsCard({
  rankings,
}: {
  rankings: Awaited<ReturnType<typeof getProductRankings>>;
}) {
  const maxQty = Math.max(1, ...rankings.map((r) => r.totalQty));

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-brand-near-black">
          {t.admin.stats.topProductsTitle}
        </h3>
        <p className="mt-0.5 text-[11px] text-brand-gray">
          {t.admin.stats.topProductsSubtitle}
        </p>
      </CardHeader>
      <CardBody>
        {rankings.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-brand-gray">
            {t.admin.stats.noProductsOrdered}
          </p>
        ) : (
          <ul className="space-y-2">
            {rankings.map((r, idx) => {
              const widthPct = (r.totalQty / maxQty) * 100;
              const meta = [r.variant, r.unit ? `×${r.unit}` : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={`${r.name}-${idx}`} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] text-brand-gray-light">
                    {idx + 1}
                  </span>
                  <span className="shrink-0 text-[16px] leading-none">
                    {r.emoji || getProductEmoji(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-brand-near-black">
                        {r.name}
                        {meta && (
                          <span className="ml-1 font-normal text-brand-gray-light">{meta}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-bold text-brand-near-black">
                        {r.totalQty}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div
                        className="h-full rounded-full bg-brand-orange"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between font-mono text-[10px] text-brand-gray-light">
                      <span>{t.admin.stats.cyclesCountLabel(r.cyclesCount)}</span>
                      <span>{formatEur(r.totalAmount)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Revenue trend — inline SVG area + line chart ─────────────────────────────

function RevenueTrendCard({
  trend,
}: {
  trend: Awaited<ReturnType<typeof getCycleRevenueTrend>>;
}) {
  if (trend.length === 0) {
    return null;
  }

  const W = 320;
  const H = 100;
  const PAD = 8;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const maxVal = Math.max(1, ...trend.map((p) => p.total));

  // Point coordinates in the SVG viewBox.
  const points = trend.map((p, idx) => {
    const x = trend.length === 1 ? W / 2 : PAD + (idx * innerW) / (trend.length - 1);
    const y = PAD + innerH - (p.total / maxVal) * innerH;
    return { x, y, ...p };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  // Close the path back along the baseline to form the filled area.
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`;

  const lastPoint = points[points.length - 1];
  const prevPoint = points.length >= 2 ? points[points.length - 2] : null;
  const trendDelta =
    prevPoint && prevPoint.total > 0
      ? ((lastPoint.total - prevPoint.total) / prevPoint.total) * 100
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold text-brand-near-black">
              {t.admin.stats.trendTitle}
            </h3>
            <p className="mt-0.5 text-[11px] text-brand-gray">
              {t.admin.stats.trendSubtitle(trend.length)}
            </p>
          </div>
          {trendDelta !== null && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                trendDelta >= 0
                  ? "bg-brand-teal-light text-brand-teal"
                  : "bg-brand-red-light text-brand-red"
              }`}
            >
              {trendDelta >= 0 ? "+" : ""}
              {trendDelta.toFixed(0)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: H }}
          preserveAspectRatio="none"
          role="img"
          aria-label={t.admin.stats.trendAriaLabel}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-orange)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--color-brand-orange)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#revenueGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-brand-orange)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p) => (
            <circle
              key={p.cycleId}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="var(--color-brand-orange)"
            >
              <title>
                {p.title}: {formatEur(p.total)} ({p.orderCount} {t.admin.stats.filterMembers})
              </title>
            </circle>
          ))}
        </svg>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-brand-gray-light">
          <span>{trend[0].title}</span>
          <span>{trend[trend.length - 1].title}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-mono text-[10px] uppercase text-brand-gray-light">{t.admin.stats.trendLast}</div>
            <div className="font-mono text-[12px] font-bold text-brand-near-black">
              {formatEur(lastPoint.total)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-brand-gray-light">{t.admin.stats.trendMax}</div>
            <div className="font-mono text-[12px] font-bold text-brand-near-black">
              {formatEur(maxVal)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-brand-gray-light">{t.admin.stats.trendAvg}</div>
            <div className="font-mono text-[12px] font-bold text-brand-near-black">
              {formatEur(trend.reduce((s, p) => s + p.total, 0) / trend.length)}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Supplier ranking ─────────────────────────────────────────────────────────

function SupplierStatsCard({
  suppliers,
}: {
  suppliers: Awaited<ReturnType<typeof getSupplierStats>>;
}) {
  const withActivity = suppliers.filter((s) => s.cyclesCount > 0);
  if (withActivity.length === 0) return null;
  const maxRevenue = Math.max(1, ...withActivity.map((s) => s.totalRevenue));

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-brand-near-black">{t.admin.stats.supplierStatsTitle}</h3>
        <p className="mt-0.5 text-[11px] text-brand-gray">{t.admin.stats.supplierStatsSubtitle}</p>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2">
          {withActivity.map((s) => {
            const widthPct = (s.totalRevenue / maxRevenue) * 100;
            return (
              <li key={s.supplierId}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-brand-near-black">
                    {s.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-brand-near-black">
                    {formatEur(s.totalRevenue)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full bg-brand-teal"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between font-mono text-[10px] text-brand-gray-light">
                  <span>{t.admin.stats.cyclesCountLabel(s.cyclesCount)}</span>
                  {s.topProductName && <span>{t.admin.stats.supplierTopProduct(s.topProductName)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

// ── Member participation ─────────────────────────────────────────────────────

function MemberParticipationCard({
  members,
}: {
  members: Awaited<ReturnType<typeof getMemberParticipation>>;
}) {
  // Surface the engagement distribution: heavy users (≥3 cycles), occasional
  // (1-2), and dormant (0). The split helps the admin spot members who
  // dropped off without scanning the entire list.
  const heavy = members.filter((m) => m.cyclesOrdered >= 3);
  const occasional = members.filter((m) => m.cyclesOrdered >= 1 && m.cyclesOrdered < 3);
  const dormant = members.filter((m) => m.cyclesOrdered === 0);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-[13px] font-bold text-brand-near-black">{t.admin.stats.memberParticipationTitle}</h3>
        <p className="mt-0.5 text-[11px] text-brand-gray">
          {t.admin.stats.memberParticipationSubtitle(members.length)}
        </p>
      </CardHeader>
      <CardBody>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-brand-teal-light p-2">
            <div className="font-mono text-[10px] uppercase text-brand-teal">{t.admin.stats.participationActive}</div>
            <div className="text-[18px] font-black text-brand-near-black">{heavy.length}</div>
            <div className="font-mono text-[10px] text-brand-gray-light">{t.admin.stats.participationActiveHint}</div>
          </div>
          <div className="rounded-lg bg-brand-orange-light p-2">
            <div className="font-mono text-[10px] uppercase text-brand-orange">{t.admin.stats.participationOccasional}</div>
            <div className="text-[18px] font-black text-brand-near-black">{occasional.length}</div>
            <div className="font-mono text-[10px] text-brand-gray-light">{t.admin.stats.participationOccasionalHint}</div>
          </div>
          <div className="rounded-lg bg-black/[0.05] p-2">
            <div className="font-mono text-[10px] uppercase text-brand-gray">{t.admin.stats.participationDormant}</div>
            <div className="text-[18px] font-black text-brand-near-black">{dormant.length}</div>
            <div className="font-mono text-[10px] text-brand-gray-light">{t.admin.stats.participationDormantHint}</div>
          </div>
        </div>

        <details className="text-[12px]">
          <summary className="cursor-pointer font-semibold text-brand-gray hover:text-brand-near-black">
            {t.admin.stats.memberDetail}
          </summary>
          <ul className="mt-2 divide-y divide-brand-border rounded-lg border border-brand-border bg-white">
            {members.map((m) => (
              <li
                key={m.memberId}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-brand-near-black">
                  {m.fullName}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-brand-gray">
                  {t.admin.stats.memberCyclesLabel(m.cyclesOrdered)}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-brand-near-black">
                  {formatEur(m.totalSpent)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </CardBody>
    </Card>
  );
}

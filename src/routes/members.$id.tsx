import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getMember,
  getMemberAlpha,
  getMemberDecay,
  getMemberDistrictConcentration,
  getMemberQuality,
  listCommittees,
  listTransactions,
} from "@/api/client";
import { PartyChip } from "@/components/PartyChip";
import { FlagRow } from "@/components/FlagBadge";
import { RelTime } from "@/components/RelTime";
import {
  fmtPctRaw,
  fmtUSDRange,
  ownerTypeLabel,
  signClass,
  transactionTypeLabel,
} from "@/lib/format";
import { SkeletonRows } from "@/components/SkeletonRows";

export const Route = createFileRoute("/members/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Member ${params.id} — CongressTrade Intelligence` },
      {
        name: "description",
        content: `Composite trading scores, holdings, and signal context for member ${params.id}.`,
      },
    ],
  }),
  component: MemberDetail,
});

const SECTOR_COLORS = [
  "#06b6d4",
  "#a78bfa",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#a3a3a3",
  "#525252",
];

// SPEC §4 horizons surfaced by /members/{id}/alpha.
const ALPHA_HORIZONS = [30, 90, 180, 365] as const;
// SPEC §4 post-disclosure decay horizons surfaced by /members/{id}/decay.
const DECAY_HORIZONS = [0, 7, 14, 30, 60, 90] as const;
// Per audit: hide ranking-style numbers when the member has fewer than 10 trades.
const MIN_SUFFICIENT_TRADES = 10;

function parseDecimal(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function MemberDetail() {
  const { id } = Route.useParams();
  const memberQuery = useQuery({ queryKey: ["member", id], queryFn: () => getMember(id) });
  const txnsQuery = useQuery({
    queryKey: ["member-tx", id],
    queryFn: () => listTransactions({ member_id: id, limit: 50 }),
  });
  const committeesQuery = useQuery({ queryKey: ["committees-all"], queryFn: listCommittees });
  const alphaQuery = useQuery({
    queryKey: ["member-alpha", id],
    queryFn: () => getMemberAlpha(id),
  });
  const decayQuery = useQuery({
    queryKey: ["member-decay", id],
    queryFn: () => getMemberDecay(id),
  });
  const concentrationQuery = useQuery({
    queryKey: ["member-concentration", id],
    queryFn: () => getMemberDistrictConcentration(id),
  });
  const qualityQuery = useQuery({
    queryKey: ["member-quality", id],
    queryFn: () => getMemberQuality(id),
  });

  const member = memberQuery.data;
  const txns = txnsQuery.data;
  const committees = committeesQuery.data;

  if (memberQuery.isLoading || !member) {
    return (
      <div className="p-4">
        <SkeletonRows rows={12} cols={6} />
      </div>
    );
  }

  const committeeIds = new Set(member.committees.map((c) => c.id));
  const cmtNames = (committees ?? []).filter((c) => committeeIds.has(c.id));
  const alphaByHorizon = new Map((alphaQuery.data?.points ?? []).map((p) => [p.horizon_days, p]));
  const alpha90 = alphaByHorizon.get(90);
  const alpha180 = alphaByHorizon.get(180);
  const alphaSufficient = (alpha90?.n_trades ?? 0) >= MIN_SUFFICIENT_TRADES;
  const conc = concentrationQuery.data;
  const quality = qualityQuery.data;
  const isHouse = member.chamber === "house";
  const hasConcentrationData = !!conc && conc.district_id != null && conc.total_trade_count > 0;
  const highZ = conc?.z_score_vs_baseline != null && conc.z_score_vs_baseline >= 3;

  // Holdings: aggregate by ticker from txns
  const holdings = (txns?.items ?? []).reduce(
    (acc, t) => {
      const sign = t.type === "buy" ? 1 : t.type === "sell" ? -1 : 0;
      const mid = (t.amount_min + t.amount_max) / 2;
      const k = t.ticker;
      if (!acc[k])
        acc[k] = {
          ticker: k,
          net: 0,
          lastDate: t.transaction_date,
          count: 0,
          company: t.company_name ?? "",
        };
      acc[k].net += sign * mid;
      acc[k].count += 1;
      if (new Date(t.transaction_date) > new Date(acc[k].lastDate))
        acc[k].lastDate = t.transaction_date;
      return acc;
    },
    {} as Record<
      string,
      { ticker: string; net: number; lastDate: string; count: number; company: string }
    >,
  );
  const holdingsArr = Object.values(holdings).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-[var(--text-primary)]">{member.name}</h1>
              <PartyChip party={member.party} state={member.state} chamber={member.chamber} />
              {member.district && (
                <span className="num text-[10px] text-[var(--text-tertiary)]">
                  D-{member.district}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cmtNames.map((c) => (
                <Link
                  key={c.id}
                  to="/committees/$id"
                  params={{ id: c.id }}
                  className="rounded bg-[var(--bg-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--cyan)]"
                >
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="num mt-2 text-[10px] text-[var(--text-tertiary)]">
              {member.tenure_years > 0 && <>{member.tenure_years}y tenure · </>}
              <span title="Library of Congress bioguide identifier">{member.bioguide_id}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <HeaderScore
              label="α 180d"
              loading={alphaQuery.isLoading}
              insufficient={!alphaSufficient}
              n={alpha180?.n_trades ?? 0}
              value={parseDecimal(alpha180?.mean_alpha ?? null)}
              format={(v) => fmtPctRaw(v)}
              colorize
            />
            <HeaderScore
              label="Hit rate 90d"
              loading={alphaQuery.isLoading}
              insufficient={!alphaSufficient}
              n={alpha90?.n_trades ?? 0}
              value={parseDecimal(alpha90?.hit_rate ?? null)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <HeaderScore
              label="Filing q."
              loading={qualityQuery.isLoading}
              insufficient={(quality?.n_transactions ?? 0) === 0}
              n={quality?.n_transactions ?? 0}
              value={quality?.composite_quality_score ?? null}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <HeaderScore
              label="Vagueness"
              loading={qualityQuery.isLoading}
              insufficient={(quality?.n_transactions ?? 0) === 0}
              n={quality?.n_transactions ?? 0}
              value={quality?.vagueness_score_avg ?? null}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              warningWhen={(v) => v > 0.4}
            />
          </div>
        </div>
      </div>

      {/* Outsized in-district concentration callout — surfaced when z >= 3 */}
      {highZ && conc && (
        <div className="rounded border border-[var(--warning)] bg-[var(--warning)]/10 px-4 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--warning)]">
              Outlier finding
            </span>
            <span className="text-sm text-[var(--text-primary)]">
              Trades own-district companies far more than average —{" "}
              <span className="num font-medium text-[var(--warning)]">
                {conc.in_district_trade_count} of {conc.total_trade_count}
              </span>{" "}
              trades involve companies headquartered in {conc.state}-{conc.district_num}.
              <span
                className="num ml-1 text-[10px] text-[var(--text-tertiary)]"
                title="Standard deviations above the cross-member baseline"
              >
                ({conc.z_score_vs_baseline!.toFixed(1)}× the typical rate)
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left col */}
        <div className="space-y-3 lg:col-span-5">
          <AlphaPanel
            loading={alphaQuery.isLoading}
            error={alphaQuery.error as Error | null}
            data={alphaQuery.data ?? null}
          />

          <DecayPanel
            loading={decayQuery.isLoading}
            error={decayQuery.error as Error | null}
            data={decayQuery.data ?? null}
          />

          <ConcentrationPanel
            loading={concentrationQuery.isLoading}
            error={concentrationQuery.error as Error | null}
            data={conc ?? null}
            isHouse={isHouse}
            hasData={hasConcentrationData}
          />

          <QualityPanel
            loading={qualityQuery.isLoading}
            error={qualityQuery.error as Error | null}
            data={quality ?? null}
          />

          {member.sector_tilt.length > 0 && (
            <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Sector tilt
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={member.sector_tilt}
                        dataKey="weight"
                        innerRadius={36}
                        outerRadius={64}
                        stroke="var(--bg-1)"
                        strokeWidth={1}
                      >
                        {member.sector_tilt.map((_, i) => (
                          <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {member.sector_tilt.slice(0, 6).map((s, i) => (
                    <div key={s.sector} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                      />
                      <span className="flex-1 truncate">{s.sector}</span>
                      <span className="num text-[var(--text-secondary)]">
                        {(s.weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {member.hearing_proximity.length > 0 && (
            <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Trades near committee hearings
              </div>
              <div className="mt-3" style={{ height: 140 }}>
                <ResponsiveContainer>
                  <BarChart data={member.hearing_proximity}>
                    <XAxis
                      dataKey="proximity_days"
                      tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                      stroke="var(--border)"
                    />
                    <YAxis hide />
                    <RTooltip
                      contentStyle={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => `${v >= 0 ? "+" : ""}${v} days`}
                    />
                    <Bar dataKey="count">
                      {member.hearing_proximity.map((p, i) => (
                        <Cell
                          key={i}
                          fill={
                            p.signed > 0.1
                              ? "var(--positive)"
                              : p.signed < -0.1
                                ? "var(--negative)"
                                : "var(--text-tertiary)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right col */}
        <div className="space-y-3 lg:col-span-7">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Holdings (cumulative buy − sell)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-1.5 text-left">Ticker</th>
                    <th className="px-3 py-1.5 text-left">Company</th>
                    <th className="px-3 py-1.5 text-right">Net est.</th>
                    <th className="px-3 py-1.5 text-right">Trades</th>
                    <th className="px-3 py-1.5 text-right">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsArr.slice(0, 12).map((h) => (
                    <tr
                      key={h.ticker}
                      className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          to="/tickers/$symbol"
                          params={{ symbol: h.ticker }}
                          className="num text-[var(--cyan)] hover:underline"
                        >
                          {h.ticker}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-[var(--text-secondary)] truncate">
                        {h.company}
                      </td>
                      <td className={"num px-3 py-1.5 text-right " + signClass(h.net)}>
                        {h.net >= 0 ? "+" : ""}${(Math.abs(h.net) / 1000).toFixed(0)}K
                      </td>
                      <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                        {h.count}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <RelTime iso={h.lastDate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Recent trades
            </div>
            <div className="max-h-[420px] overflow-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-1)] text-[10px] uppercase text-[var(--text-tertiary)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-1.5 text-left">Ticker</th>
                      <th className="px-3 py-1.5 text-left">Type</th>
                      <th className="px-3 py-1.5 text-right">Amount</th>
                      <th className="px-3 py-1.5 text-left">Owner</th>
                      <th className="px-3 py-1.5 text-left">Flags</th>
                      <th className="px-3 py-1.5 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns?.items.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                      >
                        <td className="px-3 py-1.5">
                          <Link
                            to="/tickers/$symbol"
                            params={{ symbol: t.ticker }}
                            className="num text-[var(--cyan)] hover:underline"
                          >
                            {t.ticker}
                          </Link>
                        </td>
                        <td
                          className={
                            "px-3 py-1.5 text-[10px] " +
                            (t.type === "buy"
                              ? "text-[var(--positive)]"
                              : t.type === "sell"
                                ? "text-[var(--negative)]"
                                : "text-[var(--text-secondary)]")
                          }
                        >
                          {transactionTypeLabel(t.type)}
                        </td>
                        <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                          {fmtUSDRange(t.amount_min, t.amount_max)}
                        </td>
                        <td className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">
                          {ownerTypeLabel(t.owner_type)}
                        </td>
                        <td className="px-3 py-1.5">
                          <FlagRow flags={t.flags} />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <RelTime iso={t.transaction_date} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderScore({
  label,
  loading,
  insufficient,
  n,
  value,
  format,
  colorize,
  warningWhen,
}: {
  label: string;
  loading: boolean;
  insufficient: boolean;
  n: number;
  value: number | null;
  format: (v: number) => string;
  colorize?: boolean;
  warningWhen?: (v: number) => boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="num mt-0.5 text-2xl">
        {loading ? (
          <span className="text-[var(--text-tertiary)]">—</span>
        ) : insufficient || value == null ? (
          <span className="text-[var(--text-tertiary)]" title={`insufficient sample (n=${n})`}>
            <span className="text-[var(--text-secondary)]">—</span>
          </span>
        ) : (
          <span
            className={
              colorize
                ? signClass(value)
                : warningWhen && warningWhen(value)
                  ? "text-[var(--warning)]"
                  : "text-[var(--text-primary)]"
            }
          >
            {format(value)}
          </span>
        )}
      </div>
      {!loading && (insufficient || value == null) && (
        <div className="num text-[9px] text-[var(--text-tertiary)]">n={n} · insufficient</div>
      )}
    </div>
  );
}

function AlphaPanel({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: Error | null;
  data: import("@/api/types").MemberAlphaResponse | null;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Excess return vs benchmark
        </div>
        {data && (
          <div className="num text-[9px] text-[var(--text-tertiary)]">
            benchmark: {data.benchmark}
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {ALPHA_HORIZONS.map((h) => (
            <div key={h} className="rounded bg-[var(--bg-2)] p-2.5">
              <div className="num text-[10px] text-[var(--text-tertiary)]">α {h}d</div>
              <div className="mt-1 num text-sm text-[var(--text-tertiary)]">—</div>
            </div>
          ))}
        </div>
      ) : error || !data ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">Alpha series unavailable.</div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {ALPHA_HORIZONS.map((h) => {
            const point = data.points.find((p) => p.horizon_days === h);
            const meanAlpha = parseDecimal(point?.mean_alpha ?? null);
            const hitRate = parseDecimal(point?.hit_rate ?? null);
            const n = point?.n_trades ?? 0;
            const insufficient = n < MIN_SUFFICIENT_TRADES;
            return (
              <div key={h} className="rounded bg-[var(--bg-2)] p-2.5">
                <div className="flex items-baseline justify-between">
                  <div className="num text-[10px] text-[var(--text-tertiary)]">α {h}d</div>
                  <div className="num text-[9px] text-[var(--text-tertiary)]">n={n}</div>
                </div>
                {insufficient ? (
                  <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                    insufficient sample
                  </div>
                ) : (
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <div
                      className={"num text-sm " + (meanAlpha != null ? signClass(meanAlpha) : "")}
                    >
                      {meanAlpha != null ? fmtPctRaw(meanAlpha) : "—"}
                    </div>
                    <div className="num text-[10px] text-[var(--text-secondary)]">
                      hit {hitRate != null ? `${(hitRate * 100).toFixed(0)}%` : "—"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecayPanel({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: Error | null;
  data: import("@/api/types").DisclosureDecayResponse | null;
}) {
  const points = (data?.points ?? []).map((p) => ({
    horizon_days: p.horizon_days,
    excess: parseDecimal(p.mean_excess_return),
    n: p.n_trades,
  }));
  const hasAnyData = points.some((p) => p.excess != null && p.n > 0);
  const chartData = points
    .filter((p) => p.excess != null)
    .map((p) => ({ horizon_days: p.horizon_days, excess_pct: (p.excess as number) * 100 }));

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          How quickly does the edge fade after disclosure?
        </div>
        {data && hasAnyData && (
          <div className="num text-[9px] text-[var(--text-tertiary)]">
            n={data.points[0]?.n_trades ?? 0} BUYs
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-[140px] animate-pulse rounded bg-[var(--bg-2)]/40" />
      ) : error || !data ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">Decay curve unavailable.</div>
      ) : !hasAnyData ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">
          insufficient sample to compute decay
        </div>
      ) : (
        <div className="mt-3" style={{ height: 140 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 3" vertical={false} />
              <XAxis
                dataKey="horizon_days"
                type="number"
                domain={[0, 90]}
                ticks={[...DECAY_HORIZONS]}
                tickFormatter={(v) => `${v}d`}
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                stroke="var(--border)"
              />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                stroke="var(--border)"
                width={36}
              />
              <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeDasharray="3 3" />
              <RTooltip
                contentStyle={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  fontSize: 11,
                }}
                labelFormatter={(v) => `+${v}d post-disclosure`}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "excess return"]}
              />
              <Line
                type="monotone"
                dataKey="excess_pct"
                stroke="var(--cyan)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--cyan)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ConcentrationPanel({
  loading,
  error,
  data,
  isHouse,
  hasData,
}: {
  loading: boolean;
  error: Error | null;
  data: import("@/api/types").MemberDistrictConcentration | null;
  isHouse: boolean;
  hasData: boolean;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        Trading own district
      </div>
      {loading ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">—</div>
      ) : error || !data ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">Concentration unavailable.</div>
      ) : !isHouse ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">
          N/A — Senate (in-district concentration is a House-only metric).
        </div>
      ) : !hasData ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">
          N/A — no district trades on record for this member.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">In-district</div>
            <div className="num mt-0.5 text-lg text-[var(--text-primary)]">
              {data.in_district_trade_count}
              <span className="text-[var(--text-tertiary)]"> / {data.total_trade_count}</span>
            </div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">
              {data.district_num != null ? (
                <Link
                  to="/districts/$state/$district"
                  params={{ state: data.state, district: String(data.district_num) }}
                  className="hover:text-[var(--cyan)] hover:underline"
                  title="District page"
                >
                  {data.state}-{data.district_num} →
                </Link>
              ) : (
                <>{data.state}</>
              )}
            </div>
          </div>
          <div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">Concentration</div>
            <div className="num mt-0.5 text-lg text-[var(--text-primary)]">
              {data.district_concentration_ratio != null
                ? `${(data.district_concentration_ratio * 100).toFixed(2)}%`
                : "—"}
            </div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">
              baseline{" "}
              {data.baseline_mean_ratio != null
                ? `${(data.baseline_mean_ratio * 100).toFixed(2)}%`
                : "—"}
            </div>
          </div>
          <div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">Z-score</div>
            <div
              className={
                "num mt-0.5 text-lg " +
                (data.z_score_vs_baseline == null
                  ? "text-[var(--text-tertiary)]"
                  : data.z_score_vs_baseline >= 3
                    ? "text-[var(--warning)]"
                    : data.z_score_vs_baseline >= 2
                      ? "text-[var(--cyan)]"
                      : "text-[var(--text-primary)]")
              }
            >
              {data.z_score_vs_baseline != null ? `${data.z_score_vs_baseline.toFixed(2)}σ` : "—"}
            </div>
            <div className="num text-[10px] text-[var(--text-tertiary)]">vs universe</div>
          </div>
        </div>
      )}
    </div>
  );
}

function QualityPanel({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: Error | null;
  data: import("@/api/types").FilingQualityBreakdown | null;
}) {
  const composite = data?.composite_quality_score ?? null;
  const compositeBand =
    composite == null
      ? "text-[var(--text-tertiary)]"
      : composite >= 0.8
        ? "text-[var(--positive)]"
        : composite >= 0.5
          ? "text-[var(--text-primary)]"
          : "text-[var(--warning)]";
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Disclosure quality
        </div>
        {data && (
          <div className="num text-[9px] text-[var(--text-tertiary)]">
            {data.n_transactions} txns · {data.n_filings} filings
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">—</div>
      ) : error || !data ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">
          Quality breakdown unavailable.
        </div>
      ) : data.n_transactions === 0 ? (
        <div className="mt-3 text-xs text-[var(--text-tertiary)]">
          No disclosed transactions on record.
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-3">
            <div className={"num text-2xl " + compositeBand}>
              {composite != null ? `${(composite * 100).toFixed(0)}%` : "—"}
            </div>
            <div className="num text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              composite
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3 md:grid-cols-5">
            <QualityStat
              label="Lag (avg)"
              value={data.reporting_lag_avg_days}
              format={(v) => `${v.toFixed(1)}d`}
              warn={(v) => v > 45}
            />
            <QualityStat
              label="Late %"
              value={data.late_filing_rate}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              warn={(v) => v > 0.1}
            />
            <QualityStat
              label="Vagueness"
              value={data.vagueness_score_avg}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              warn={(v) => v > 0.5}
            />
            <QualityStat
              label="Amend %"
              value={data.amendment_rate}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              warn={(v) => v > 0.2}
            />
            <QualityStat
              label="Complete"
              value={data.completeness_score}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              good={(v) => v > 0.8}
            />
          </div>
        </>
      )}
    </div>
  );
}

function QualityStat({
  label,
  value,
  format,
  warn,
  good,
}: {
  label: string;
  value: number | null | undefined;
  format: (v: number) => string;
  warn?: (v: number) => boolean;
  good?: (v: number) => boolean;
}) {
  const v = value;
  const cls =
    v == null
      ? "text-[var(--text-tertiary)]"
      : warn && warn(v)
        ? "text-[var(--warning)]"
        : good && good(v)
          ? "text-[var(--positive)]"
          : "text-[var(--text-primary)]";
  return (
    <div>
      <div className="num text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className={"num mt-0.5 " + cls}>{v == null ? "—" : format(v)}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getDistrict,
  getMemberDistrictConcentration,
  listDistrictAlerts,
} from "@/api/client";
import { alertKindLabel, kindColor } from "@/api/alertKinds";
import { fmtUSD } from "@/lib/format";
import { PartyChip } from "@/components/PartyChip";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/districts/$state/$district")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.state}-${params.district} district — CongressTrade Intelligence` },
      {
        name: "description",
        content: `Alert and trade activity for House district ${params.state}-${params.district}.`,
      },
    ],
  }),
  component: DistrictDetail,
});

function DistrictDetail() {
  const { state, district } = Route.useParams();
  const num = Number(district);
  const validNum = Number.isFinite(num) && num >= 0;

  const districtQuery = useQuery({
    queryKey: ["district", state, num],
    queryFn: () => getDistrict(state, num),
    enabled: validNum,
  });

  const alertsQuery = useQuery({
    queryKey: ["district-alerts", state, num],
    queryFn: () => listDistrictAlerts(state, num, { limit: 100 }),
    enabled: validNum,
  });

  // Pull the seat-holder's district concentration once we know the official.
  // This surfaces the load-bearing empirical pattern (DelBene WA-1/Microsoft
  // z=+6.43) that the audit P0 #10 flagged as invisible.
  const officialId = districtQuery.data?.member?.official_id;
  const concentrationQuery = useQuery({
    queryKey: ["district-concentration", officialId],
    queryFn: () => getMemberDistrictConcentration(officialId as string),
    enabled: !!officialId,
  });

  if (!validNum) {
    return (
      <div className="rounded border border-[var(--negative)]/40 bg-[var(--bg-1)] p-4 text-xs text-[var(--negative)]">
        Invalid district number.
      </div>
    );
  }

  const d = districtQuery.data;
  const alerts = alertsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            <Link
              to="/districts"
              search={{ sort: "alert_count_90d", q: "" }}
              className="hover:underline"
            >
              Districts
            </Link>{" "}
            / {state}-{district}
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            {d?.chamber ?? "—"}
            {d?.congress_number != null && ` · ${d.congress_number}th Congress`}
          </p>
        </div>
        {d?.population_2020 != null && (
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            pop {d.population_2020.toLocaleString()} (2020)
          </p>
        )}
      </div>

      {districtQuery.isLoading ? (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <SkeletonRows rows={3} cols={3} />
        </div>
      ) : !d ? (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 text-xs text-[var(--text-tertiary)]">
          District not found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Seat holder
            </div>
            {d.member ? (
              <div className="mt-2 space-y-1">
                <Link
                  to="/members/$id"
                  params={{ id: d.member.official_id }}
                  className="text-sm text-[var(--text-primary)] hover:underline"
                >
                  {d.member.full_name}
                </Link>
                <div>
                  <PartyChip
                    party={(d.member.party ?? "I") as "D" | "R" | "I"}
                    state={d.member.state}
                    chamber={d.member.chamber.toLowerCase() as "house" | "senate"}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                {d.chamber === "SENATE"
                  ? "Statewide row — multiple Senate members."
                  : "Vacant or unmapped."}
              </div>
            )}
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Alert activity (90d)
            </div>
            <div className="mt-2 num text-lg text-[var(--text-primary)]">
              {(d.alert_count_90d ?? 0).toLocaleString()}
            </div>
            <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">
              {(d.critical_count_90d ?? 0).toLocaleString()} critical
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Recent trades
            </div>
            <div className="mt-2 num text-lg text-[var(--text-primary)]">
              {(d.recent_activity ?? []).length}
            </div>
            <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">on record</div>
          </div>
        </div>
      )}

      {concentrationQuery.data &&
        concentrationQuery.data.z_score_vs_baseline != null &&
        concentrationQuery.data.district_concentration_ratio != null &&
        concentrationQuery.data.baseline_mean_ratio != null &&
        concentrationQuery.data.total_trade_count != null &&
        concentrationQuery.data.in_district_trade_count != null && (
          <ConcentrationCard
            data={{
              district_concentration_ratio:
                concentrationQuery.data.district_concentration_ratio,
              z_score_vs_baseline: concentrationQuery.data.z_score_vs_baseline,
              baseline_mean_ratio: concentrationQuery.data.baseline_mean_ratio,
              total_trade_count: concentrationQuery.data.total_trade_count,
              in_district_trade_count:
                concentrationQuery.data.in_district_trade_count,
            }}
            memberId={officialId}
          />
        )}

      {/* Recent trades */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <span>Recent trades</span>
          <span className="num text-[var(--text-tertiary)]">
            {(d?.recent_activity ?? []).length} shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Date</th>
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Ticker</th>
                <th className="px-3 py-1.5 text-left">Company</th>
                <th className="px-3 py-1.5 text-left">Side</th>
                <th className="px-3 py-1.5 text-right">Max value</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Hide rows that lack both a ticker and a company name — those
                // are usually disclosure-form filings that didn't resolve to
                // an instrument (e.g. fund holdings, bond positions). Showing
                // them as 20 rows of em-dashes makes the page look broken.
                const visible = (d?.recent_activity ?? []).filter(
                  (a) => a.ticker != null || a.company_name != null,
                );
                const hidden = (d?.recent_activity ?? []).length - visible.length;
                if (visible.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                        No recent trades with resolved tickers.
                        {hidden > 0 && (
                          <div className="mt-1 text-[10px]">
                            ({hidden} trade{hidden === 1 ? "" : "s"} on record without an identified
                            instrument.)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }
                return (
                  <>
                    {visible.map((a) => (
                      <tr
                        key={`${a.transaction_id}-${a.ticker ?? a.transaction_date}`}
                        className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                      >
                        <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">
                          {a.transaction_date ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          {a.official_id ? (
                            <Link
                              to="/members/$id"
                              params={{ id: a.official_id }}
                              className="text-[var(--text-primary)] hover:underline"
                            >
                              {a.official_name ?? "—"}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-secondary)]">
                              {a.official_name ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {a.ticker ? (
                            <Link
                              to="/tickers/$symbol"
                              params={{ symbol: a.ticker }}
                              className="num text-[var(--cyan)] hover:underline"
                            >
                              {a.ticker}
                            </Link>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                          {a.company_name ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <DirectionChip d={a.transaction_type} />
                        </td>
                        <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                          {a.amount_max_usd
                            ? fmtUSD(Number(a.amount_max_usd), { compact: true })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {hidden > 0 && (
                      <tr className="bg-[var(--bg-2)]/40">
                        <td
                          colSpan={6}
                          className="px-3 py-2 text-center text-[10px] text-[var(--text-tertiary)]"
                        >
                          + {hidden} more trade{hidden === 1 ? "" : "s"} on record without an
                          identified ticker.
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* District alerts */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <span>District alerts</span>
          <span className="num text-[var(--text-tertiary)]">
            {alerts.length} shown · seat holder + overlapping state officials
          </span>
        </div>
        {alertsQuery.isLoading ? (
          <div className="p-3">
            <SkeletonRows rows={6} cols={4} />
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-3 py-6 text-center text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            no alerts
          </div>
        ) : (
          <div>
            {alerts.map((a) => (
              <div
                key={a.alert_id}
                className="flex flex-wrap items-center gap-3 border-b border-[var(--border)]/40 px-3 py-1.5 text-xs"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    a.severity === "critical" ? "bg-[var(--negative)]" : "bg-[var(--warning)]",
                  )}
                />
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ring-1",
                    kindColor(a.kind),
                  )}
                  title={a.kind}
                >
                  {alertKindLabel(a.kind)}
                </span>
                <span className="flex-1 text-[var(--text-secondary)]">{a.headline ?? "—"}</span>
                <RelTime iso={a.created_at} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Visual cue for `z_score_vs_baseline`: > 2 is statistically notable
// (~2.5%-of-population tail), > 4 is "look at this member specifically"
// territory, > 6 is the DelBene/Microsoft anchor pattern.
function zScoreClass(z: number): string {
  if (z >= 6) return "text-[var(--red)]";
  if (z >= 4) return "text-[var(--amber)]";
  if (z >= 2) return "text-[var(--cyan)]";
  return "text-[var(--text-secondary)]";
}

function ConcentrationCard({
  data,
  memberId,
}: {
  data: {
    district_concentration_ratio: number;
    z_score_vs_baseline: number;
    baseline_mean_ratio: number;
    total_trade_count: number;
    in_district_trade_count: number;
  };
  memberId?: string;
}) {
  const z = data.z_score_vs_baseline;
  const ratioPct = (data.district_concentration_ratio * 100).toFixed(1);
  const baselinePct = (data.baseline_mean_ratio * 100).toFixed(2);
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <span>In-district concentration</span>
        {memberId && (
          <Link
            to="/members/$id"
            params={{ id: memberId }}
            className="text-[var(--cyan)] hover:underline"
          >
            member detail →
          </Link>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Z-score vs national baseline
          </div>
          <div className={"num mt-0.5 text-2xl font-medium " + zScoreClass(z)}>
            {z >= 0 ? "+" : ""}
            {z.toFixed(2)}σ
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            In-district share
          </div>
          <div className="num mt-0.5 text-2xl font-medium text-[var(--text-primary)]">
            {ratioPct}%
          </div>
          <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">
            {data.in_district_trade_count}/{data.total_trade_count} trades
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            National baseline
          </div>
          <div className="num mt-0.5 text-2xl font-medium text-[var(--text-secondary)]">
            {baselinePct}%
          </div>
          <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">
            mean House member
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        Fraction of this member's trades in companies headquartered in their own
        district, vs the national House baseline. A z-score above 4σ identifies
        members with materially disproportionate constituency exposure. Slice-16
        also feeds this signal into +10% score_v2 boosts on in-district
        VOTE_TRADE / STATEMENT_CONTRADICTION alerts.
      </p>
    </div>
  );
}

function DirectionChip({ d }: { d?: string | null }) {
  if (!d) return <span className="text-[var(--text-tertiary)]">—</span>;
  const u = d.toUpperCase();
  const cls =
    u === "BUY"
      ? "text-[var(--positive)]"
      : u === "SELL"
        ? "text-[var(--negative)]"
        : "text-[var(--text-secondary)]";
  return <span className={"num text-[10px] uppercase " + cls}>{u}</span>;
}

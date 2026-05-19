import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getLeaderboard } from "@/api/client";
import type { LeaderboardEntry, LeaderboardKind } from "@/api/types-ui";
import { PartyChip } from "@/components/PartyChip";
import { fmtPctRaw, signClass } from "@/lib/format";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

// `options_conviction` is the legacy tab that silently fell back to
// composite at the adapter layer (no /leaderboard column backs it).
// Dropped from the visible tab list per audit P3 #54; the LeaderboardKind
// union keeps it for URL-search-param back-compat.
type VisibleKind = Exclude<LeaderboardKind, "options_conviction">;
const VISIBLE_KINDS: VisibleKind[] = [
  "composite",
  "alpha",
  "hit_rate",
  "filing_quality",
  "late_filer",
  "vagueness",
];

const fmtPct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtPct0 = (v: number) => `${(v * 100).toFixed(0)}`;

type TabMeta = {
  kind: VisibleKind;
  label: string;
  select: (r: LeaderboardEntry) => number | null;
  fmt: (v: number) => string;
  cls?: (v: number) => string;
  description: string;
};

const TABS: TabMeta[] = [
  {
    kind: "composite",
    label: "Overall",
    select: (r) => r.composite_score,
    fmt: (v) => v.toFixed(2),
    description:
      "Overall score — combines after-trade returns, win rate, disclosure quality, and alert frequency. Higher = more notable trader.",
  },
  {
    kind: "alpha",
    label: "90-day return",
    select: (r) => r.alpha_90d,
    fmt: (v) => fmtPctRaw(v),
    cls: signClass,
    description:
      "Average 90-day return after a trade, above what a sector ETF returned the same period.",
  },
  {
    kind: "hit_rate",
    label: "Win rate",
    select: (r) => r.hit_rate_90d,
    fmt: fmtPct1,
    description: "Share of buy trades that beat the sector benchmark over 90 days.",
  },
  {
    kind: "filing_quality",
    label: "Disclosure quality",
    select: (r) => r.filing_quality_score,
    fmt: fmtPct0,
    description:
      "How well the member discloses trades — timeliness, specificity, completeness, corrections.",
  },
  {
    kind: "late_filer",
    label: "Late filer",
    select: (r) => r.late_filing_rate,
    fmt: fmtPct0,
    cls: (v) => (v > 0.3 ? "text-[var(--warning)]" : ""),
    description:
      "Share of trades disclosed more than 45 days after the trade (the STOCK Act deadline). Lower is better.",
  },
  {
    kind: "vagueness",
    label: "Vagueness",
    select: (r) => r.vagueness_score_avg,
    fmt: fmtPct0,
    cls: (v) => (v > 0.4 ? "text-[var(--warning)]" : ""),
    description: "How precisely the member describes their trades. Lower = more specific.",
  },
];

function isVisibleKind(k: string): k is VisibleKind {
  return (VISIBLE_KINDS as string[]).includes(k);
}

export const Route = createFileRoute("/leaderboards")({
  validateSearch: (s: Record<string, unknown>): { tab: VisibleKind } => {
    const t = typeof s.tab === "string" && isVisibleKind(s.tab) ? s.tab : "composite";
    return { tab: t };
  },
  head: () => ({
    meta: [
      { title: "Leaderboards — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "Member rankings by composite score, alpha, hit rate, filing quality, and lateness.",
      },
    ],
  }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/leaderboards" });
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab],
    queryFn: () => getLeaderboard(tab),
  });
  const meta = TABS.find((t) => t.kind === tab) ?? TABS[0];

  const rows = useMemo(() => data ?? [], [data]);
  // Q1 of *sufficient-sample* members for the active metric — the audit
  // notes 66% of critical signals land on Q1, so we render the top
  // quartile with a subtle accent.
  const q1Cutoff = useMemo(() => {
    const scored = rows
      .filter((r) => r.has_sufficient_sample)
      .map((r) => meta.select(r))
      .filter((v): v is number => v != null);
    if (scored.length === 0) return null;
    // For descending metrics Q1 = top quartile (highest scores). For
    // ascending metrics (late_filer, vagueness) Q1 = lowest quartile.
    const ascending = tab === "late_filer" || tab === "vagueness";
    const sorted = [...scored].sort((a, b) => (ascending ? a - b : b - a));
    const idx = Math.max(0, Math.floor(sorted.length * 0.25) - 1);
    return sorted[idx];
  }, [rows, meta, tab]);

  const inQ1 = (r: LeaderboardEntry): boolean => {
    if (!r.has_sufficient_sample || q1Cutoff == null) return false;
    const v = meta.select(r);
    if (v == null) return false;
    const ascending = tab === "late_filer" || tab === "vagueness";
    return ascending ? v <= q1Cutoff : v >= q1Cutoff;
  };

  const sufficientCount = rows.filter((r) => r.has_sufficient_sample).length;
  const insufficientCount = rows.length - sufficientCount;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Member rankings
          </h1>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {sufficientCount} ranked · {insufficientCount} below the 10-trade minimum · top 25%
            highlighted
          </p>
        </div>
        <p className="max-w-[420px] text-right text-[10px] text-[var(--text-tertiary)]">
          {meta.description}
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => navigate({ search: { tab: t.kind } })}
            className={cn(
              "border-b-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors -mb-px",
              tab === t.kind
                ? "border-[var(--cyan)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">#</th>
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Aff.</th>
                <th className="px-3 py-1.5 text-right" title="Active tab metric">
                  {meta.label}
                </th>
                <th className="px-3 py-1.5 text-right" title="Composite score (Slice-9)">
                  Composite
                </th>
                <th className="px-3 py-1.5 text-right" title="Lifetime trades">
                  n
                </th>
                <th className="px-3 py-1.5 text-right" title="Alerts (lifetime / critical)">
                  Alerts
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-3">
                    <SkeletonRows rows={12} cols={7} />
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                    No leaderboard data.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const insufficient = !r.has_sufficient_sample;
                const score = meta.select(r);
                const q1 = inQ1(r);
                return (
                  <tr
                    key={r.member_id}
                    className={cn(
                      "border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]",
                      insufficient && "opacity-60",
                      q1 && "bg-[var(--cyan)]/[0.04]",
                    )}
                  >
                    <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">
                      {insufficient ? "—" : (r.rank_overall ?? r.rank)}
                    </td>
                    <td className="px-3 py-1.5">
                      <Link
                        to="/members/$id"
                        params={{ id: r.member_id }}
                        className="text-[var(--text-primary)] hover:underline"
                      >
                        {r.member_name}
                      </Link>
                      {insufficient && (
                        <span
                          className="ml-2 text-[9px] uppercase text-[var(--text-tertiary)]"
                          title="Below the 10-trade minimum needed for a reliable estimate."
                        >
                          low data ({r.n_trades_lifetime})
                        </span>
                      )}
                      {q1 && (
                        <span
                          className="ml-2 rounded bg-[var(--cyan)]/15 px-1 py-0.5 text-[8px] uppercase text-[var(--cyan)] ring-1 ring-[var(--cyan)]/30"
                          title="Top 25% on this metric. Most platform alerts concentrate on these members."
                        >
                          Top 25%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <PartyChip party={r.party} state={r.state} chamber={r.chamber} />
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        score == null
                          ? "text-[var(--text-tertiary)]"
                          : (meta.cls?.(score) ?? "text-[var(--text-primary)]"),
                      )}
                    >
                      {score == null ? "—" : meta.fmt(score)}
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        r.composite_score == null
                          ? "text-[var(--text-tertiary)]"
                          : "text-[var(--text-secondary)]",
                      )}
                    >
                      {r.composite_score == null ? "—" : r.composite_score.toFixed(3)}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                      {r.n_trades_lifetime}
                      {r.n_trades_90d > 0 && (
                        <span
                          className="num ml-1 text-[9px] text-[var(--text-tertiary)]"
                          title="trailing 90d"
                        >
                          +{r.n_trades_90d}
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                      {r.alert_count_lifetime}
                      {r.critical_alert_count_lifetime > 0 && (
                        <span
                          className="num ml-1 rounded bg-[var(--red)]/15 px-1 text-[9px] text-[var(--red)] ring-1 ring-[var(--red)]/30"
                          title="critical-severity alerts (lifetime)"
                        >
                          {r.critical_alert_count_lifetime}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

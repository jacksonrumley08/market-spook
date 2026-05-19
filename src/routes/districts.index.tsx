import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getDistrictsHeatmap } from "@/api/client";
import type { DistrictHeatmapEntry } from "@/api/types";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

type SortKey = "alert_count_90d" | "critical_count_90d" | "alert_count_lifetime" | "state";
type Search = { sort: SortKey; q: string };

const SORT_LABELS: Record<SortKey, string> = {
  alert_count_90d: "90d alerts",
  critical_count_90d: "Critical 90d",
  alert_count_lifetime: "Lifetime alerts",
  state: "State",
};

export const Route = createFileRoute("/districts/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const sortRaw = typeof s.sort === "string" ? s.sort : "alert_count_90d";
    const sort: SortKey = (Object.keys(SORT_LABELS) as SortKey[]).includes(sortRaw as SortKey)
      ? (sortRaw as SortKey)
      : "alert_count_90d";
    const q = typeof s.q === "string" ? s.q : "";
    return { sort, q };
  },
  head: () => ({
    meta: [
      { title: "Districts — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "Congressional district alert-density heatmap. 441 House districts ranked by trailing 90d alert volume and lifetime alert counts.",
      },
    ],
  }),
  component: DistrictsPage,
});

function DistrictsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [pendingQ, setPendingQ] = useState(search.q);

  const { data, isLoading } = useQuery({
    queryKey: ["districts-heatmap"],
    queryFn: getDistrictsHeatmap,
  });

  // Memoize the empty fallback so dependent useMemos don't re-fire on every
  // render while the query is loading.
  const items: DistrictHeatmapEntry[] = useMemo(() => data ?? [], [data]);

  // Q1 cutoff for trailing 90d alert density — the audit notes most signal
  // concentrates in the top quartile. We accent rows in Q1 the same way
  // the leaderboard does.
  const q1Cutoff = useMemo(() => {
    const vals = items.map((d) => d.alert_count_90d).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => b - a);
    const idx = Math.max(0, Math.floor(sorted.length * 0.25) - 1);
    return sorted[idx];
  }, [items]);

  const max90d = useMemo(() => items.reduce((m, d) => Math.max(m, d.alert_count_90d), 0), [items]);

  const filtered = useMemo(() => {
    const q = search.q.trim().toUpperCase();
    return items.filter((d) => {
      if (!q) return true;
      const label = `${d.state}-${d.district_num ?? ""}`.toUpperCase();
      return d.state.toUpperCase().includes(q) || label.includes(q);
    });
  }, [items, search.q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (search.sort === "state") {
      arr.sort((a, b) => {
        if (a.state !== b.state) return a.state.localeCompare(b.state);
        return (a.district_num ?? 0) - (b.district_num ?? 0);
      });
    } else {
      const k = search.sort;
      arr.sort((a, b) => (b[k] as number) - (a[k] as number));
    }
    return arr;
  }, [filtered, search.sort]);

  const totalActive = items.filter((d) => d.alert_count_90d > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Districts heatmap
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            {items.length} districts · {totalActive} with 90d activity · top quartile accented
          </p>
        </div>
        <p className="num max-w-[420px] text-right text-[10px] text-[var(--text-tertiary)]">
          Alert density by congressional district (HOUSE + statewide SENATE). NJ-5 leads at ~3× the
          next-busiest district.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={pendingQ}
          onChange={(e) => setPendingQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void navigate({ search: (p) => ({ ...p, q: pendingQ }) });
            if (e.key === "Escape") {
              setPendingQ("");
              void navigate({ search: (p) => ({ ...p, q: "" }) });
            }
          }}
          placeholder="Filter by state or district (e.g. NJ, CA-13)…"
          className="h-7 flex-1 min-w-[200px] rounded border border-[var(--border)] bg-[var(--bg-1)] px-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
        <div className="flex gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => void navigate({ search: (p) => ({ ...p, sort: k }) })}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-mono uppercase tracking-wider ring-1",
                search.sort === k
                  ? "bg-[var(--cyan)]/15 text-[var(--cyan)] ring-[var(--cyan)]/30"
                  : "bg-[var(--bg-1)] text-[var(--text-tertiary)] ring-[var(--border)] hover:text-[var(--text-secondary)]",
              )}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">#</th>
                <th className="px-3 py-1.5 text-left">District</th>
                <th className="px-3 py-1.5 text-left">Chamber</th>
                <th className="px-3 py-1.5 text-right" title="OPEN+resolved alerts in trailing 90d">
                  90d alerts
                </th>
                <th className="px-3 py-1.5 text-left">Density</th>
                <th
                  className="px-3 py-1.5 text-right"
                  title="Critical-severity alerts (trailing 90d)"
                >
                  Critical
                </th>
                <th className="px-3 py-1.5 text-right" title="Lifetime alert count">
                  Lifetime
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
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
                    No districts match.
                  </td>
                </tr>
              )}
              {sorted.map((d, i) => {
                const districtLabel =
                  d.chamber === "SENATE"
                    ? `${d.state} (statewide)`
                    : `${d.state}-${d.district_num ?? "?"}`;
                const inQ1 =
                  q1Cutoff != null && d.alert_count_90d >= q1Cutoff && d.alert_count_90d > 0;
                const widthPct = max90d > 0 ? Math.max(2, (d.alert_count_90d / max90d) * 100) : 0;
                const isHouse = d.chamber === "HOUSE" && d.district_num != null;
                return (
                  <tr
                    key={d.district_id}
                    className={cn(
                      "border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]",
                      inQ1 && "bg-[var(--cyan)]/[0.04]",
                    )}
                  >
                    <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      {isHouse ? (
                        <Link
                          to="/districts/$state/$district"
                          params={{ state: d.state, district: String(d.district_num) }}
                          className="text-[var(--text-primary)] hover:underline"
                        >
                          {districtLabel}
                        </Link>
                      ) : (
                        <span className="text-[var(--text-secondary)]">{districtLabel}</span>
                      )}
                      {inQ1 && (
                        <span
                          className="num ml-2 rounded bg-[var(--cyan)]/15 px-1 py-0.5 text-[8px] font-mono uppercase text-[var(--cyan)] ring-1 ring-[var(--cyan)]/30"
                          title="Top quartile by 90d alert density"
                        >
                          Q1
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                      {d.chamber}
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        d.alert_count_90d > 0
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)]",
                      )}
                    >
                      {d.alert_count_90d.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="h-1.5 w-full rounded-full bg-[var(--bg-2)]">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            inQ1 ? "bg-[var(--cyan)]" : "bg-[var(--text-tertiary)]/40",
                          )}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        d.critical_count_90d > 0
                          ? "text-[var(--red)]"
                          : "text-[var(--text-tertiary)]",
                      )}
                    >
                      {d.critical_count_90d}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                      {d.alert_count_lifetime.toLocaleString()}
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

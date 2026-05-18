import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getIngestionHealth } from "@/api/client";
import type { SourceHealthOut } from "@/api/types";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({
  head: () => ({
    meta: [
      { title: "Ingestion health — CongressTrade Intelligence" },
      {
        name: "description",
        content: "Per-source ingestion health: last success, consecutive failures, last error.",
      },
    ],
  }),
  component: HealthPage,
});

// Sort order: DEGRADED first (operational attention), then DISABLED, then
// HEALTHY alphabetically. Within each status group, alphabetical by name.
const STATUS_ORDER: Record<string, number> = {
  DEGRADED: 0,
  DISABLED: 1,
  HEALTHY: 2,
};

function statusOrder(s: string): number {
  return STATUS_ORDER[s] ?? 99;
}

function statusClass(s: string): string {
  switch (s) {
    case "HEALTHY":
      return "bg-[var(--positive)]/20 text-[var(--positive)] ring-[var(--positive)]/30";
    case "DEGRADED":
      return "bg-[var(--warning)]/20 text-[var(--warning)] ring-[var(--warning)]/30";
    case "DISABLED":
      return "bg-[var(--bg-2)] text-[var(--text-tertiary)] ring-[var(--border)]";
    default:
      return "bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)]";
  }
}

function HealthPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-health"],
    queryFn: getIngestionHealth,
    refetchInterval: 60_000,
  });

  const sources: SourceHealthOut[] = data?.sources ?? [];
  const sorted = [...sources].sort((a, b) => {
    const so = statusOrder(a.health_status) - statusOrder(b.health_status);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });

  const counts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.health_status] = (acc[s.health_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Ingestion health
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            {sources.length} sources ·{" "}
            <span className="text-[var(--positive)]">{counts.HEALTHY ?? 0} healthy</span>
            {(counts.DEGRADED ?? 0) > 0 && (
              <>
                {" · "}
                <span className="text-[var(--warning)]">{counts.DEGRADED} degraded</span>
              </>
            )}
            {(counts.DISABLED ?? 0) > 0 && (
              <>
                {" · "}
                <span className="text-[var(--text-tertiary)]">{counts.DISABLED} disabled</span>
              </>
            )}
            {" · auto-refresh 60s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:opacity-40"
        >
          {isFetching ? "refreshing…" : "refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-[var(--negative)]/40 bg-[var(--bg-1)] p-3 text-xs text-[var(--negative)]">
          Failed to load: {(error as Error).message}
        </div>
      )}

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">Source</th>
              <th className="px-3 py-1.5 text-left">Kind</th>
              <th className="px-3 py-1.5 text-left">Status</th>
              <th className="px-3 py-1.5 text-right">Failures</th>
              <th className="px-3 py-1.5 text-left">Last run</th>
              <th className="px-3 py-1.5 text-left">Last success</th>
              <th className="px-3 py-1.5 text-left">Last failure</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-3">
                  <SkeletonRows rows={8} cols={7} />
                </td>
              </tr>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
                  No sources reporting.
                </td>
              </tr>
            )}
            {sorted.map((s) => {
              const isExpanded = expanded === s.name;
              return (
                <Fragment key={s.name}>
                  <tr
                    onClick={() => setExpanded(isExpanded ? null : s.name)}
                    className="cursor-pointer border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                  >
                    <td className="num px-3 py-1.5 text-[var(--text-primary)]">{s.name}</td>
                    <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                      {s.kind}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1",
                          statusClass(s.health_status),
                        )}
                      >
                        {s.health_status}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        s.consecutive_failures > 0
                          ? "text-[var(--warning)]"
                          : "text-[var(--text-tertiary)]",
                      )}
                    >
                      {s.consecutive_failures}
                    </td>
                    <td className="px-3 py-1.5">
                      {s.last_run_at ? (
                        <RelTime iso={s.last_run_at} />
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {s.last_success_at ? (
                        <RelTime iso={s.last_success_at} />
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {s.last_failure_at ? (
                        <RelTime iso={s.last_failure_at} />
                      ) : (
                        <span className="text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                  </tr>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="border-b border-[var(--border)]/40 bg-[var(--bg-0)]"
                      >
                        <td colSpan={7} className="p-3">
                          <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2">
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                Last failure reason
                              </div>
                              <div className="num mt-1 text-[var(--text-secondary)]">
                                {s.last_failure_reason ?? "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                Raw payload
                              </div>
                              <pre className="num mt-1 overflow-auto text-[10px] text-[var(--text-tertiary)]">
                                {JSON.stringify(s, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

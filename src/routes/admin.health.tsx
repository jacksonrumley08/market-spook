import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getIngestionHealth } from "@/api/client";
import type { SourceHealthOut } from "@/api/types";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { sourceLabel } from "@/lib/format";
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

// Sort order. Backend now ships display_status directly (HEALTHY / STALE /
// IDLE / DEFERRED / DEGRADED / DISABLED). DEGRADED + DISABLED + STALE bubble
// to the top because they need operator attention; IDLE and DEFERRED are
// known-not-running states; HEALTHY is last.
const STATUS_ORDER: Record<string, number> = {
  DEGRADED: 0,
  DISABLED: 1,
  STALE: 2,
  IDLE: 3,
  DEFERRED: 4,
  HEALTHY: 5,
};

function statusOrder(s: string): number {
  return STATUS_ORDER[s] ?? 99;
}

// Trust the backend's display_status when present; fall back to a
// client-side derivation for back-compat during the rolling deploy where
// older API responses lack the field.
function effectiveStatus(s: SourceHealthOut): string {
  if (s.display_status) return s.display_status;
  if (s.health_status === "HEALTHY" && s.last_run_at == null && s.last_success_at == null) {
    return "IDLE";
  }
  return s.health_status;
}

function statusClass(s: string): string {
  switch (s) {
    case "HEALTHY":
      return "bg-[var(--positive)]/20 text-[var(--positive)] ring-[var(--positive)]/30";
    case "STALE":
      return "bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30";
    case "IDLE":
      return "bg-[var(--bg-2)] text-[var(--text-secondary)] ring-[var(--border)]";
    case "DEFERRED":
      return "bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30";
    case "DEGRADED":
      return "bg-[var(--warning)]/20 text-[var(--warning)] ring-[var(--warning)]/30";
    case "DISABLED":
      return "bg-[var(--negative)]/15 text-[var(--negative)] ring-[var(--negative)]/30";
    default:
      return "bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)]";
  }
}

function kindLabel(kind: string): string {
  if (kind === "API") return "REST API";
  if (kind === "SCRAPER") return "Web scraper";
  return kind;
}

function populationBadge(p: SourceHealthOut["population"]): {
  label: string;
  klass: string;
  title: string;
} | null {
  if (p === "real") return null; // dominant case — no badge needed
  if (p === "seeded") {
    return {
      label: "Synthetic",
      klass: "bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30",
      title:
        "Hand-curated stub rows behind this source — the live scraper is deferred. Counts shown across the app for this source are not real ingestion output.",
    };
  }
  return {
    label: "Deferred",
    klass: "bg-[var(--bg-2)] text-[var(--text-secondary)] ring-[var(--border)]",
    title: "Source intentionally not running per v1 ship plan.",
  };
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
    const so = statusOrder(effectiveStatus(a)) - statusOrder(effectiveStatus(b));
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });

  const counts = sources.reduce<Record<string, number>>((acc, s) => {
    const k = effectiveStatus(s);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Ingestion health
          </h1>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {sources.length} sources ·{" "}
            <span className="text-[var(--positive)]">{counts.HEALTHY ?? 0} healthy</span>
            {(counts.STALE ?? 0) > 0 && (
              <>
                {" · "}
                <span
                  className="text-[var(--amber)]"
                  title="Last successful run is older than the per-kind staleness threshold (24h for API sources, 48h for scrapers, 72h for PDF). Cron may be stuck."
                >
                  {counts.STALE} stale
                </span>
              </>
            )}
            {(counts.IDLE ?? 0) > 0 && (
              <>
                {" · "}
                <span
                  className="text-[var(--text-secondary)]"
                  title="HEALTHY status but never produced a run — backend may not have wired the cron yet"
                >
                  {counts.IDLE} idle
                </span>
              </>
            )}
            {(counts.DEFERRED ?? 0) > 0 && (
              <>
                {" · "}
                <span
                  className="text-[var(--purple)]"
                  title="Source scraper deferred per v1 ship plan (Senate EFD, House staffer JS-portal, state ethics). Stub still registers as HEALTHY in the FSM."
                >
                  {counts.DEFERRED} deferred
                </span>
              </>
            )}
            {(counts.DEGRADED ?? 0) > 0 && (
              <>
                {" · "}
                <span className="text-[var(--warning)]">{counts.DEGRADED} degraded</span>
              </>
            )}
            {(counts.DISABLED ?? 0) > 0 && (
              <>
                {" · "}
                <span
                  className="text-[var(--negative)]"
                  title="Auto-paused after consecutive failures. Recover via `just unblock-source <name>` on the host."
                >
                  {counts.DISABLED} disabled
                </span>
              </>
            )}
            {" · auto-refresh every minute"}
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Source</th>
                <th className="px-3 py-1.5 text-left">Type</th>
                <th className="px-3 py-1.5 text-left">Status</th>
                <th
                  className="px-3 py-1.5 text-right"
                  title="Currently OPEN or ACKNOWLEDGED INGESTION_HEALTH alerts for this source"
                >
                  Open alerts
                </th>
                <th
                  className="px-3 py-1.5 text-right"
                  title="Consecutive failures since last success"
                >
                  Failures
                </th>
                <th className="px-3 py-1.5 text-left">Last run</th>
                <th className="px-3 py-1.5 text-left">Last success</th>
                <th className="px-3 py-1.5 text-left">Last failure</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-3">
                    <SkeletonRows rows={8} cols={7} />
                  </td>
                </tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
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
                      <td
                        className="px-3 py-1.5 text-[var(--text-primary)]"
                        title={`Internal key: ${s.name}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{sourceLabel(s.name)}</span>
                          {(() => {
                            const badge = populationBadge(s.population);
                            return badge ? (
                              <span
                                title={badge.title}
                                className={cn(
                                  "rounded px-1 py-px text-[9px] uppercase tracking-wider ring-1",
                                  badge.klass,
                                )}
                              >
                                {badge.label}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">
                        {kindLabel(s.kind)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ring-1",
                            statusClass(effectiveStatus(s)),
                          )}
                        >
                          {effectiveStatus(s)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-1.5 text-right",
                          s.open_health_alerts > 0
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-tertiary)]",
                        )}
                        title={
                          s.open_health_alerts > 0
                            ? "INGESTION_HEALTH alerts (e.g. high_loss_rate) that the FSM didn't escalate"
                            : undefined
                        }
                      >
                        {s.open_health_alerts}
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
                          <td colSpan={8} className="p-3">
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              <div className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                                Last failure reason
                              </div>
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {s.last_failure_reason ?? (
                                  <span className="text-[var(--text-tertiary)]">
                                    No failure reason recorded.
                                  </span>
                                )}
                              </div>
                              {effectiveStatus(s) === "DISABLED" && (
                                <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                                  Recover via{" "}
                                  <code className="rounded bg-[var(--bg-2)] px-1">
                                    just unblock-source {s.name}
                                  </code>{" "}
                                  on the host.
                                </div>
                              )}
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
    </div>
  );
}

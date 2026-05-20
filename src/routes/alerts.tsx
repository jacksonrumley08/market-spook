import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeAlert, listAlerts } from "@/api/client";
import {
  ACTIVE_ALERT_KINDS,
  ALERT_KINDS,
  ALERT_STATUSES,
  alertKindDescription,
  alertKindLabel,
  kindColor,
  type AlertStatusLiteral,
} from "@/api/alertKinds";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";
import type { AlertOut, Paginated } from "@/api/types-ui";

// Per-page cap. Backend hard-caps `/alerts?limit` at 200.
const PAGE_LIMIT = 50;
// Cap for per-kind count fetches. Anything more than this and we render "200+".
const COUNT_PROBE_LIMIT = 200;

type Search = {
  kind?: string;
  status: AlertStatusLiteral;
  page: number;
};

export const Route = createFileRoute("/alerts")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const kindRaw = typeof s.kind === "string" ? s.kind : undefined;
    const kind =
      kindRaw && (ALERT_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : undefined;
    const statusRaw = typeof s.status === "string" ? s.status.toUpperCase() : "OPEN";
    const status: AlertStatusLiteral = (ALERT_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as AlertStatusLiteral)
      : "OPEN";
    const pageRaw = Number(s.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    return { kind, status, page };
  },
  head: () => ({
    meta: [
      { title: "Alerts — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "Filterable event stream of vote-trade, lobbying, news, contract, cluster, and ops alerts.",
      },
    ],
  }),
  component: AlertsPage,
});

function fmtScore(score: number | null): string {
  if (score == null) return "—";
  return score.toFixed(1);
}

// score_v2 ranges roughly 0..100 in practice. Color hot/cold so the eye can
// scan the rank visually without a sparkline.
function scoreClass(score: number | null): string {
  if (score == null) return "text-[var(--text-tertiary)]";
  if (score >= 80) return "text-[var(--red)]";
  if (score >= 60) return "text-[var(--amber)]";
  if (score >= 40) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function AlertsPage() {
  const { kind, status, page } = Route.useSearch();
  const navigate = useNavigate({ from: "/alerts" });
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const offset = (page - 1) * PAGE_LIMIT;

  const setSearch = (next: Partial<Search>) => {
    navigate({
      search: (prev: Search) => ({
        ...prev,
        ...next,
      }),
    });
  };

  const alertsQuery = useQuery({
    queryKey: ["alerts", status, kind ?? null, page],
    queryFn: () =>
      listAlerts({
        status,
        kind,
        limit: PAGE_LIMIT,
        offset,
      }),
  });

  // Per-kind count probes. One query per kind, gated to the current status
  // filter, capped at COUNT_PROBE_LIMIT so we can show "200+" for hot kinds
  // (NEWS_TRADE_PROXIMITY routinely has 1900+ alerts). React-Query caches per
  // [status, kind] so flipping status fires 15 small parallel hits once, then
  // stale-while-revalidates for a minute.
  const kindCountQueries = useQueries({
    queries: ACTIVE_ALERT_KINDS.map((k) => ({
      queryKey: ["alerts-count", status, k] as const,
      queryFn: () => listAlerts({ status, kind: k, limit: COUNT_PROBE_LIMIT, offset: 0 }),
      staleTime: 60_000,
    })),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["alerts", status, kind ?? null, page] });
      const prev = queryClient.getQueryData<Paginated<AlertOut>>([
        "alerts",
        status,
        kind ?? null,
        page,
      ]);
      if (prev) {
        queryClient.setQueryData<Paginated<AlertOut>>(["alerts", status, kind ?? null, page], {
          ...prev,
          items: prev.items.map((a) =>
            a.id === id
              ? { ...a, status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString() }
              : a,
          ),
        });
      }
      return { prev };
    },
    onError: (err: unknown, _id: string, ctx?: { prev?: Paginated<AlertOut> }) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["alerts", status, kind ?? null, page], ctx.prev);
      }
      const msg = err instanceof Error ? err.message : "Failed to acknowledge alert";
      toast.error(msg);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts-count"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts-unread"] });
    },
  });

  const data = alertsQuery.data;
  const items = data?.items ?? [];
  const hasMore = data?.has_more ?? false;
  const isLoading = alertsQuery.isLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Alerts
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            page {page} · {items.length} shown
            {kind && (
              <>
                {" "}
                · filtered to{" "}
                <span className="text-[var(--text-secondary)]">{alertKindLabel(kind)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Status filter — segmented control */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {ALERT_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setSearch({ status: s, page: 1 })}
            className={cn(
              "border-b-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors -mb-px",
              status === s
                ? "border-[var(--cyan)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>

      {/* Kind filter pills */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setSearch({ kind: undefined, page: 1 })}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1 transition-colors",
            !kind
              ? "bg-[var(--cyan)]/15 text-[var(--cyan)] ring-[var(--cyan)]/30"
              : "bg-[var(--bg-1)] text-[var(--text-tertiary)] ring-[var(--border)] hover:text-[var(--text-secondary)]",
          )}
        >
          All
        </button>
        {ACTIVE_ALERT_KINDS.map((k, i) => {
          const q = kindCountQueries[i];
          const countItems = q.data?.items.length ?? 0;
          const more = q.data?.has_more ?? false;
          const countLabel = q.isLoading
            ? "…"
            : more
              ? `${COUNT_PROBE_LIMIT}+`
              : String(countItems);
          const isZero = !q.isLoading && countItems === 0 && !more;
          const isActive = kind === k;
          return (
            <button
              key={k}
              onClick={() => setSearch({ kind: isActive ? undefined : k, page: 1 })}
              disabled={isZero && !isActive}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1 transition-colors",
                isActive
                  ? kindColor(k)
                  : isZero
                    ? "bg-[var(--bg-1)] text-[var(--text-tertiary)]/60 ring-[var(--border)]/50 cursor-not-allowed"
                    : "bg-[var(--bg-1)] text-[var(--text-tertiary)] ring-[var(--border)] hover:text-[var(--text-secondary)]",
              )}
              title={isZero ? `No ${status} alerts of this kind` : alertKindLabel(k)}
            >
              {alertKindLabel(k)}
              <span className="ml-1.5 opacity-70">{countLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        {isLoading && (
          <div className="p-3">
            <SkeletonRows rows={8} cols={6} />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-[var(--text-tertiary)]">
            No {status.toLowerCase()} alerts
            {kind ? ` for ${alertKindLabel(kind)}` : ""}.
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="border-b border-[var(--border)]/40">
            <div className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs">
              <button
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="flex flex-1 items-center gap-3 text-left hover:opacity-90"
              >
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (a.severity === "critical" ? "bg-[var(--negative)]" : "bg-[var(--warning)]")
                  }
                />
                <span
                  title={
                    a.score_v2 == null
                      ? "Older alert without a composite score"
                      : "Overall priority — higher = more notable"
                  }
                  className={cn("num w-12 text-right tabular-nums", scoreClass(a.score_v2))}
                >
                  {fmtScore(a.score_v2)}
                  {a.score_v2 == null && (
                    <span className="ml-0.5 text-[8px] text-[var(--text-tertiary)]">∗</span>
                  )}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ring-1",
                    kindColor(a.kind),
                  )}
                  title={alertKindDescription(a.kind) ?? a.kind}
                >
                  {alertKindLabel(a.kind)}
                </span>
                <span className="flex-1 truncate text-[var(--text-primary)]">{a.summary}</span>
              </button>
              <NewsLink alert={a} />
              <JusticeLink alert={a} />
              {a.member_id && (
                <Link
                  onClick={(e) => e.stopPropagation()}
                  to="/members/$id"
                  params={{ id: a.member_id }}
                  className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--cyan)]"
                >
                  member →
                </Link>
              )}
              {a.ticker ? (
                <Link
                  onClick={(e) => e.stopPropagation()}
                  to="/tickers/$symbol"
                  params={{ symbol: a.ticker }}
                  className="num text-[10px] text-[var(--cyan)] hover:underline"
                >
                  {a.ticker}
                </Link>
              ) : a.company_name ? (
                <span
                  className="text-[10px] text-[var(--text-secondary)]"
                  title="No ticker resolved for this company — drill-through unavailable"
                >
                  {a.company_name}
                </span>
              ) : null}
              <RelTime iso={a.created_at} />
              {a.status === "OPEN" ? (
                <button
                  onClick={() => ackMutation.mutate(a.id)}
                  disabled={ackMutation.isPending && ackMutation.variables === a.id}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1",
                    "bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)]",
                    "hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {ackMutation.isPending && ackMutation.variables === a.id ? "…" : "ack"}
                </button>
              ) : (
                <span className="num text-[9px] uppercase text-[var(--text-tertiary)]">
                  {a.status.toLowerCase()}
                </span>
              )}
            </div>
            <AnimatePresence>
              {expandedId === a.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-[var(--border)]/40 bg-[var(--bg-0)]"
                >
                  <pre className="num overflow-auto p-3 text-[11px] text-[var(--text-secondary)]">
                    {JSON.stringify(a.payload, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <button
            onClick={() => setSearch({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← prev
          </button>
          <span className="num">page {page}</span>
          <button
            onClick={() => setSearch({ page: page + 1 })}
            disabled={!hasMore}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

// Drill-through link for alert kinds whose payload carries a source URL —
// NEWS_TRADE_PROXIMITY (GDELT article), STATEMENT_TRADE_CONTRADICTION (member
// statement page). Renders an external-link icon with the headline as the
// tooltip + tone color for news. No-op for alert kinds without source_url.
function NewsLink({ alert }: { alert: AlertOut }) {
  const url = pickStr(alert.payload, "source_url");
  if (!url) return null;
  const headline = pickStr(alert.payload, "headline") ?? url;
  const tone = pickNum(alert.payload, "tone");
  const toneColor =
    tone == null
      ? "text-[var(--text-tertiary)] hover:text-[var(--cyan)]"
      : tone < -1
        ? "text-[var(--negative)] hover:text-[var(--cyan)]"
        : tone > 1
          ? "text-[var(--positive)] hover:text-[var(--cyan)]"
          : "text-[var(--text-secondary)] hover:text-[var(--cyan)]";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      title={headline}
      className={cn("flex h-4 w-4 items-center justify-center", toneColor)}
    >
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// Drill-through link for SCOTUS_CONGRESSIONAL_OVERLAP alerts to the justice
// detail page. The detector payload carries justice_official_id so the link
// resolves directly. No-op for every other alert kind.
function JusticeLink({ alert }: { alert: AlertOut }) {
  if (alert.kind !== "SCOTUS_CONGRESSIONAL_OVERLAP") return null;
  const justiceId = pickStr(alert.payload, "justice_official_id");
  if (!justiceId) return null;
  return (
    <Link
      onClick={(e) => e.stopPropagation()}
      to="/scotus/$justice"
      params={{ justice: justiceId }}
      className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--cyan)]"
      title="View justice disclosures"
    >
      justice →
    </Link>
  );
}

function pickStr(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pickNum(o: Record<string, unknown>, k: string): number | null {
  const v = o[k];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

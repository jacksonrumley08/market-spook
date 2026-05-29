import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Activity, ExternalLink, TrendingUp, Users } from "lucide-react";
import {
  getCommitteeFlowTop,
  getDashboardSummary,
  getPredictiveFeed,
  getReactiveFeed,
  listClusters,
  listTransactions,
} from "@/api/client";
import { feedKindColor, feedKindLabel } from "@/api/alertKinds";
import type { PredictiveFeedItem, ReactiveFeedItem, SignalFeedItem } from "@/api/types-ui";
import { Sparkline } from "@/components/Sparkline";
import { RelTime } from "@/components/RelTime";
import { FlagRow } from "@/components/FlagBadge";
import {
  fmtUSD,
  fmtUSDRange,
  ownerTypeLabel,
  sentenceCaseEnum,
  signClass,
  transactionTypeLabel,
} from "@/lib/format";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — CongressTrade Intelligence" },
      {
        name: "description",
        content: "Live overview of congressional trade signals, clusters, and committee flow.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <span className={accent ?? "text-[var(--text-secondary)]"}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="num text-3xl font-medium tracking-tight text-[var(--text-primary)]">
          {value}
        </div>
        {sub}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: summary, isLoading: l1 } = useQuery({
    queryKey: ["summary"],
    queryFn: getDashboardSummary,
  });
  const { data: flow, isLoading: l2 } = useQuery({
    queryKey: ["flow-top"],
    queryFn: () => getCommitteeFlowTop(3),
  });
  const { data: clusters, isLoading: l3 } = useQuery({
    queryKey: ["clusters", "top3"],
    queryFn: () => listClusters({ limit: 3 }),
  });
  const { data: predictive } = useQuery({
    queryKey: ["feed", "predictive"],
    queryFn: getPredictiveFeed,
  });
  const { data: reactive } = useQuery({ queryKey: ["feed", "reactive"], queryFn: getReactiveFeed });
  const { data: flagged } = useQuery({
    queryKey: ["tx", "flagged-recent"],
    queryFn: () => listTransactions({ has_any_flag: true, limit: 12 }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Dashboard
        </h1>
        <p className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]" suppressHydrationWarning>
          Last update: {new Date().toISOString().slice(0, 16).replace("T", " ")}Z
        </p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StatCard
          accent="text-[var(--cyan)]"
          icon={<Activity className="h-3 w-3" />}
          label="Active flagged trades"
          value={l1 ? "—" : (summary?.active_flagged_count ?? 0)}
          sub={
            summary && <Sparkline data={summary.active_flagged_series} width={120} height={28} />
          }
        />
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <TrendingUp className="h-3 w-3 text-[var(--purple)]" /> Top committee flow
          </div>
          <div className="mt-2 space-y-1.5">
            {l2 ? (
              <SkeletonRows rows={3} cols={3} />
            ) : (
              flow?.map((f) => (
                <div key={f.sector} className="flex items-center gap-3">
                  <div className="flex-1 truncate text-xs text-[var(--text-primary)]">
                    {f.sector}
                  </div>
                  <Sparkline data={f.series} width={60} height={16} />
                  <div className={"num min-w-[64px] text-right text-xs " + signClass(f.net_usd)}>
                    {f.net_usd >= 0 ? "+" : ""}
                    {fmtUSD(f.net_usd, { compact: true })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-[var(--cluster-active)]" /> Active clusters
            </span>
            <Link to="/clusters" className="text-[var(--cyan)] hover:underline">
              view all →
            </Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {l3 ? (
              <SkeletonRows rows={3} cols={3} />
            ) : (
              clusters?.map((c) => (
                <Link
                  to="/tickers/$symbol"
                  params={{ symbol: c.ticker }}
                  key={c.id}
                  className="block rounded px-1 py-0.5 hover:bg-[var(--bg-2)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="num text-xs text-[var(--text-primary)]">{c.ticker}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] truncate">
                      {c.committee_name}
                    </span>
                    <span
                      className={
                        "num ml-auto text-[10px] uppercase " +
                        (c.direction === "buy"
                          ? "text-[var(--positive)]"
                          : "text-[var(--negative)]")
                      }
                    >
                      {c.member_count} {c.direction}
                    </span>
                  </div>
                </Link>
              ))
            )}
            <div className="num pt-1 text-[10px] text-[var(--text-tertiary)]">
              {summary?.active_clusters_count ?? 0} total active
            </div>
          </div>
        </div>
      </div>

      {/* Two-column feeds */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FeedColumn
          title="Predictive feed"
          accent="text-[var(--predictive)]"
          items={(predictive ?? []).slice(0, 24)}
          loading={!predictive}
        />
        <FeedColumn
          title="Reactive feed"
          accent="text-[var(--reactive)]"
          items={(reactive ?? []).slice(0, 24)}
          loading={!reactive}
        />
      </div>

      {/* Recent flagged trades */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Recent flagged trades
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Ticker</th>
                <th className="px-3 py-1.5 text-left">Type</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
                <th className="px-3 py-1.5 text-left">Owner</th>
                <th className="px-3 py-1.5 text-left">Flags</th>
                <th className="px-3 py-1.5 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {flagged?.items.map((t) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.08 }}
                  className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-1.5">
                    <Link
                      to="/members/$id"
                      params={{ id: t.member_id }}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {t.member_name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    <Link
                      to="/tickers/$symbol"
                      params={{ symbol: t.ticker }}
                      className="num text-[var(--cyan)] hover:underline"
                    >
                      {t.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={
                        "text-[10px] " +
                        (t.type === "buy"
                          ? "text-[var(--positive)]"
                          : t.type === "sell"
                            ? "text-[var(--negative)]"
                            : "text-[var(--text-secondary)]")
                      }
                    >
                      {transactionTypeLabel(t.type)}
                    </span>
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
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Matches the alerts page score color ramp (Session 3) so the same hot/cold
// scan applies across surfaces. score_v2 ranges ~0..120 in practice with the
// boosts in app/api/schemas/clusters.py:PredictiveFeedItem.score.
function scoreClass(score: number): string {
  if (score >= 100) return "text-[var(--red)]";
  if (score >= 70) return "text-[var(--amber)]";
  if (score >= 40) return "text-[var(--text-primary)]";
  return "text-[var(--text-secondary)]";
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function MemberLink({ id, name }: { id?: string; name: string }) {
  if (!id) return <span className="truncate text-xs text-[var(--text-secondary)]">{name}</span>;
  return (
    <Link
      to="/members/$id"
      params={{ id }}
      className="truncate text-xs text-[var(--text-primary)] hover:underline"
    >
      {name}
    </Link>
  );
}

function TickerLink({ symbol }: { symbol?: string }) {
  if (!symbol) return null;
  return (
    <Link
      to="/tickers/$symbol"
      params={{ symbol }}
      className="num text-xs text-[var(--cyan)] hover:underline"
    >
      {symbol}
    </Link>
  );
}

function KindChip({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ring-1",
        feedKindColor(kind),
      )}
      title={kind}
    >
      {feedKindLabel(kind)}
    </span>
  );
}

// Direction chip (BUY/SELL/EXCHANGE/etc).
function DirectionChip({ d }: { d?: string }) {
  if (!d) return null;
  const u = d.toUpperCase();
  const cls =
    u === "BUY"
      ? "text-[var(--positive)]"
      : u === "SELL"
        ? "text-[var(--negative)]"
        : "text-[var(--text-secondary)]";
  return <span className={"num text-[9px] uppercase " + cls}>{u}</span>;
}

// ---------- Per-kind row body for predictive feed ----------
function PredictiveRowBody({ item }: { item: PredictiveFeedItem }) {
  const d = item.detector;
  // Common right-side cluster: score + relative time. Each variant fills the
  // middle/left content with kind-specific structured fields. The left edge
  // is always: kind chip + member link.
  switch (d.kind) {
    case "vote_trade_inconsistency":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          {d.legis_num && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">{d.legis_num}</span>
          )}
          <span
            className="flex-1 truncate text-[11px] text-[var(--text-secondary)]"
            title={d.vote_description}
          >
            {truncate(d.vote_description ?? d.vote_question, 56)}
          </span>
          {d.key_vote && (
            <span
              className="rounded bg-[var(--red)]/20 px-1 py-0.5 text-[8px] font-mono uppercase text-[var(--red)]"
              title="Key vote (margin ≤ 10)"
            >
              key
            </span>
          )}
          <DirectionChip d={d.trade_direction} />
          <TickerLink symbol={item.ticker} />
        </>
      );
    case "news_trade_proximity":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <span
            className="flex-1 truncate text-[11px] text-[var(--text-secondary)]"
            title={d.headline}
          >
            {truncate(d.headline, 60)}
          </span>
          {d.tone != null && (
            <span
              className={
                "num text-[10px] " +
                (d.tone < 0 ? "text-[var(--negative)]" : "text-[var(--positive)]")
              }
              title="GDELT tone"
            >
              t{d.tone.toFixed(1)}
            </span>
          )}
          {d.source_url && (
            <a
              href={d.source_url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--text-tertiary)] hover:text-[var(--cyan)]"
              title={d.source_url}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <TickerLink symbol={item.ticker} />
        </>
      );
    case "statement_trade_contradiction":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <span
            className="rounded bg-[var(--bg-2)] px-1 py-0.5 text-[9px] font-mono uppercase text-[var(--text-tertiary)]"
            title={d.source_type}
          >
            {(d.source_type ?? "stmt").toLowerCase().replace(/_/g, " ")}
          </span>
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {d.contradiction_kind?.replace(/_/g, " ").toLowerCase()}
            {d.gics_sector && ` · ${d.gics_sector}`}
          </span>
          {d.sentiment_score != null && (
            <span
              className={
                "num text-[10px] " +
                (d.sentiment_score < 0 ? "text-[var(--negative)]" : "text-[var(--positive)]")
              }
              title="Sector sentiment"
            >
              s{d.sentiment_score.toFixed(2)}
            </span>
          )}
          <DirectionChip d={d.trade_direction} />
          {d.source_url && (
            <a
              href={d.source_url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--text-tertiary)] hover:text-[var(--cyan)]"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      );
    case "scotus_congressional_overlap":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <span className="truncate text-xs text-[var(--text-secondary)]">
            {d.justice_id ? (
              <Link
                to="/scotus/$justice"
                params={{ justice: d.justice_id }}
                className="text-[var(--text-primary)] hover:underline"
                title="View justice disclosures"
              >
                View justice →
              </Link>
            ) : (
              <span className="text-[var(--text-tertiary)]">Justice</span>
            )}
            {" ↔ "}
            {d.member_id && item.member_name ? (
              <MemberLink id={d.member_id} name={item.member_name} />
            ) : (
              <span className="text-[var(--text-tertiary)]">—</span>
            )}
          </span>
          <span className="flex-1 text-[11px] text-[var(--text-secondary)]">
            <DirectionChip d={d.justice_trade_direction} />
            {d.same_direction != null && (
              <span
                className={
                  "num ml-1 text-[10px] " +
                  (d.same_direction ? "text-[var(--negative)]" : "text-[var(--text-tertiary)]")
                }
              >
                {d.same_direction ? "co-direction" : "split"}
              </span>
            )}
            {d.proximity_days != null && (
              <span className="num ml-2 text-[10px] text-[var(--text-tertiary)]">
                ±{d.proximity_days}d
              </span>
            )}
          </span>
        </>
      );
    case "fomc_blackout":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name ?? "Fed official"} />
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            Trade inside FOMC blackout window
          </span>
        </>
      );
    case "lobbying_overlay":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {d.client_name ?? d.registrant_name ?? (
              <span className="text-[var(--text-tertiary)]">— (no client on filing)</span>
            )}
            {d.issue_codes.length > 0 && (
              <span className="num ml-2 text-[10px] text-[var(--text-tertiary)]">
                [{d.issue_codes.slice(0, 3).join(", ")}]
              </span>
            )}
          </span>
          {d.issue_sector_match && (
            <span
              className="rounded bg-[var(--purple)]/20 px-1 py-0.5 text-[8px] font-mono uppercase text-[var(--purple)]"
              title="Issue ↔ sector match"
            >
              match
            </span>
          )}
          {d.amount_usd != null && (
            <span className="num text-[10px] text-[var(--text-tertiary)]" title="LDA filing amount">
              {fmtUSD(d.amount_usd, { compact: true })}
            </span>
          )}
          {d.proximity_days != null && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">
              {d.proximity_days > 0 ? "+" : ""}
              {d.proximity_days}d
            </span>
          )}
        </>
      );
    case "contract_proximity":
    case "high_value_contract":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {d.recipient_names[0] ?? (
              <span className="text-[var(--text-tertiary)]">— (recipient unresolved)</span>
            )}
            {d.recipient_names.length > 1 && (
              <span className="num ml-1 text-[10px] text-[var(--text-tertiary)]">
                +{d.recipient_names.length - 1}
              </span>
            )}
          </span>
          {(d.award_amount ?? d.aggregated_max_amount) != null && (
            <span className="num text-[10px] text-[var(--text-primary)]" title="Award amount">
              {fmtUSD(d.award_amount ?? d.aggregated_max_amount ?? 0, { compact: true })}
            </span>
          )}
          {d.aggregated_count != null && d.aggregated_count > 1 && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">
              ×{d.aggregated_count}
            </span>
          )}
          {d.proximity_days != null && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">
              {d.proximity_days > 0 ? "+" : ""}
              {d.proximity_days}d
            </span>
          )}
        </>
      );
    case "cluster":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <TickerLink symbol={d.ticker} />
          {d.member_count != null && (
            <span className="num text-[10px] uppercase text-[var(--cluster-active)]">
              {d.member_count} members
            </span>
          )}
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {d.committee_name}
            {d.member_names.length > 0 && (
              <span className="num ml-2 text-[10px] text-[var(--text-tertiary)]">
                {d.member_names.slice(0, 3).join(", ")}
                {d.member_names.length > 3 && ` +${d.member_names.length - 3}`}
              </span>
            )}
          </span>
          <DirectionChip d={d.direction} />
        </>
      );
    case "hearing_proximity":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            Trade adjacent to a committee hearing
          </span>
          <TickerLink symbol={item.ticker} />
        </>
      );
    case "staffer_trade_proximity":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <span className="truncate text-xs text-[var(--text-secondary)]">
            {item.member_name ? (
              <MemberLink id={item.member_id} name={item.member_name} />
            ) : (
              <span className="text-[var(--text-tertiary)]" title="Staffer name not yet plumbed">
                Senior staffer
              </span>
            )}
          </span>
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {sentenceCaseEnum(d.overlay_kind)}
            {d.matched_sector && ` · ${d.matched_sector}`}
          </span>
          {d.proximity_days != null && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">
              ±{d.proximity_days}d
            </span>
          )}
        </>
      );
    case "state_official_trade_proximity":
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <span className="truncate text-xs text-[var(--text-secondary)]">
            {item.member_name ?? sentenceCaseEnum(d.office_type ?? "State official")}
            {d.state && (
              <span className="num ml-1 text-[10px] text-[var(--text-tertiary)]">[{d.state}]</span>
            )}
          </span>
          <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">
            {d.overlay_kind?.replace(/_/g, " ").toLowerCase()}
          </span>
          {d.proximity_days != null && (
            <span className="num text-[10px] text-[var(--text-tertiary)]">
              ±{d.proximity_days}d
            </span>
          )}
        </>
      );
    default:
      return (
        <>
          <KindChip kind={item.signal_kind} />
          <MemberLink id={item.member_id} name={item.member_name} />
          <TickerLink symbol={item.ticker} />
          <span className="flex-1" />
        </>
      );
  }
}

function ReactiveRowBody({ item }: { item: ReactiveFeedItem }) {
  const hp = item.hearing_proximity;
  return (
    <>
      <KindChip kind={item.signal_kind} />
      <MemberLink id={item.member_id} name={item.member_name} />
      <DirectionChip d={item.transaction_type} />
      {(item.amount_min != null || item.amount_max != null) && (
        <span className="num text-[10px] text-[var(--text-secondary)]" title={item.amount_bucket}>
          {fmtUSDRange(item.amount_min ?? 0, item.amount_max ?? item.amount_min ?? 0)}
        </span>
      )}
      {hp && (
        <span
          className="num truncate text-[10px] text-[var(--text-tertiary)]"
          title={`${hp.committee_name ?? ""}: ${hp.hearing_topic ?? ""}`}
        >
          ↔ {truncate(hp.committee_name ?? "hearing", 18)} {hp.proximity_days > 0 ? "+" : ""}
          {hp.proximity_days}d
        </span>
      )}
      {item.jurisdiction_overlap_committees.length > 0 && (
        <span
          className="rounded bg-[var(--purple)]/20 px-1 py-0.5 text-[8px] font-mono uppercase text-[var(--purple)]"
          title={item.jurisdiction_overlap_committees.join(", ")}
        >
          jur
        </span>
      )}
      <span className="flex-1" />
      <TickerLink symbol={item.ticker} />
    </>
  );
}

function FeedColumn({
  title,
  accent,
  items,
  loading,
}: {
  title: string;
  accent: string;
  items: SignalFeedItem[];
  loading?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <span className={accent}>{title}</span>
        <span className="num text-[var(--text-tertiary)]">{items.length}</span>
      </div>
      <div className="max-h-[480px] overflow-auto">
        {loading && (
          <div className="p-3">
            <SkeletonRows rows={6} cols={4} />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-3 py-6 text-center text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            No signals in this window.
          </div>
        )}
        {items.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.08, delay: Math.min(i * 0.005, 0.1) }}
            className="flex items-center gap-2 border-b border-[var(--border)]/40 px-3 py-1.5 hover:bg-[var(--bg-2)]"
          >
            {s.kind === "predictive" ? (
              <PredictiveRowBody item={s} />
            ) : (
              <ReactiveRowBody item={s} />
            )}
            <span
              className={cn(
                "num min-w-[36px] text-right text-xs tabular-nums",
                scoreClass(s.score),
              )}
              title="score_v2"
            >
              {s.score.toFixed(s.score >= 10 ? 0 : 1)}
            </span>
            <RelTime iso={s.created_at} className="ml-2 min-w-[44px] text-right" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

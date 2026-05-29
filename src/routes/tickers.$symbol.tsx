import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTickerDetail } from "@/api/client";
import { alertKindLabel } from "@/api/alertKinds";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { fmtUSDRange } from "@/lib/format";

export const Route = createFileRoute("/tickers/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol.toUpperCase()} — CongressTrade Intelligence` },
      {
        name: "description",
        content: `Congressional trading activity, alerts, and clusters for ${params.symbol.toUpperCase()}.`,
      },
    ],
  }),
  component: TickerDetail,
});

function TickerDetail() {
  const { symbol } = Route.useParams();
  const { data: t, isLoading, isError, error } = useQuery({
    queryKey: ["ticker-detail", symbol],
    queryFn: () => getTickerDetail(symbol),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonRows rows={10} cols={6} />
      </div>
    );
  }

  if (isError || !t) {
    const msg = (error as Error | undefined)?.message ?? "";
    const notFound = /404/.test(msg);
    return (
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-6 text-center text-sm text-[var(--text-secondary)]">
        <div className="num text-2xl text-[var(--text-primary)]">
          {symbol.toUpperCase()}
        </div>
        <p className="mt-2">
          {notFound
            ? "Ticker not on file. The platform only resolves symbols that have appeared in a member or judicial disclosure."
            : "Failed to load ticker detail."}
        </p>
        <Link
          to="/"
          className="mt-3 inline-block text-[var(--cyan)] hover:underline"
        >
          ← back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="num text-3xl font-medium text-[var(--text-primary)]">{t.symbol}</h1>
          {t.company_name && (
            <span className="text-sm text-[var(--text-secondary)]">{t.company_name}</span>
          )}
          {t.gics_sector && (
            <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              {t.gics_sector}
            </span>
          )}
          {t.instrument_type && t.instrument_type !== "STOCK" && (
            <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              {t.instrument_type}
            </span>
          )}
          {t.exchange && (
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              {t.exchange}
            </span>
          )}
          {!t.resolved && (
            <span
              className="rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--warning)]"
              title="Ticker symbol exists in disclosures but is not yet linked to a `companies` row. Company-name, sector, and HQ-state fields are unavailable."
            >
              Company unresolved
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Disclosed trades
            </div>
            <div className="num mt-0.5 text-2xl font-medium text-[var(--text-primary)]">
              {t.n_transactions_lifetime.toLocaleString()}
            </div>
            <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">lifetime</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Open alerts
            </div>
            <div className="num mt-0.5 text-2xl font-medium text-[var(--text-primary)]">
              {t.n_alerts_open.toLocaleString()}
            </div>
            <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">
              VOTE / CONTRACT / LOBBYING / NEWS / STATEMENT / SCOTUS
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Active clusters
            </div>
            <div className="num mt-0.5 text-2xl font-medium text-[var(--text-primary)]">
              {t.n_active_clusters}
            </div>
            <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">past 14 days</div>
          </div>
        </div>
      </div>

      {(t.active_clusters ?? []).length > 0 && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            Active clusters on {t.symbol}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-1.5 text-left">Committee</th>
                  <th className="px-3 py-1.5 text-left">Direction</th>
                  <th className="px-3 py-1.5 text-right">Members</th>
                  <th className="px-3 py-1.5 text-right">Window</th>
                </tr>
              </thead>
              <tbody>
                {(t.active_clusters ?? []).map((c) => (
                  <tr key={c.cluster_id} className="border-b border-[var(--border)]/40">
                    <td className="px-3 py-1.5 text-[var(--text-primary)]">{c.committee_name}</td>
                    <td
                      className={
                        "num px-3 py-1.5 text-[10px] uppercase " +
                        (c.direction === "BUY"
                          ? "text-[var(--positive)]"
                          : "text-[var(--negative)]")
                      }
                    >
                      {c.direction.toLowerCase()}
                    </td>
                    <td className="num px-3 py-1.5 text-right">{c.member_count}</td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-tertiary)]">
                      {c.window_start.slice(5)} → {c.window_end.slice(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(t.active_alerts ?? []).length > 0 && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            Open alerts on {t.symbol} ({t.n_alerts_open.toLocaleString()})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-1.5 text-left">Kind</th>
                  <th className="px-3 py-1.5 text-left">Severity</th>
                  <th className="px-3 py-1.5 text-right">Score</th>
                  <th className="px-3 py-1.5 text-left">Member</th>
                  <th className="px-3 py-1.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {(t.active_alerts ?? []).map((a) => (
                  <tr key={a.alert_id} className="border-b border-[var(--border)]/40">
                    <td className="px-3 py-1.5 text-[var(--text-primary)]">
                      {alertKindLabel(a.kind)}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] uppercase">
                      <span
                        className={
                          a.severity === "critical"
                            ? "text-[var(--negative)]"
                            : a.severity === "warning"
                              ? "text-[var(--warning)]"
                              : "text-[var(--text-secondary)]"
                        }
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                      {a.score_v2 == null ? "—" : Number(a.score_v2).toFixed(1)}
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
                    <td className="px-3 py-1.5 text-right">
                      <RelTime iso={a.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Recent congressional trades on {t.symbol}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Type</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
                <th className="px-3 py-1.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {(t.recent_transactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                    No congressional trades on file for this symbol.
                  </td>
                </tr>
              )}
              {(t.recent_transactions ?? []).map((tx) => (
                <tr key={tx.transaction_id} className="border-b border-[var(--border)]/40">
                  <td className="px-3 py-1.5">
                    <Link
                      to="/members/$id"
                      params={{ id: tx.official_id }}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {tx.official_name}
                    </Link>
                    {tx.party && tx.state && (
                      <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">
                        {tx.party}/{tx.state}
                      </span>
                    )}
                  </td>
                  <td
                    className={
                      "num px-3 py-1.5 text-[10px] uppercase " +
                      (tx.transaction_type === "BUY"
                        ? "text-[var(--positive)]"
                        : tx.transaction_type === "SELL"
                          ? "text-[var(--negative)]"
                          : "text-[var(--text-secondary)]")
                    }
                  >
                    {tx.transaction_type.toLowerCase()}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                    {fmtUSDRange(
                      tx.amount_min_usd ? Number(tx.amount_min_usd) : 0,
                      tx.amount_max_usd ? Number(tx.amount_max_usd) : 0,
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <RelTime iso={tx.transaction_date} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

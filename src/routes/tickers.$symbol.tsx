import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { getTicker } from "@/api/client";
import { FlagRow } from "@/components/FlagBadge";
import { RelTime } from "@/components/RelTime";
import { fmtUSDRange, signClass } from "@/lib/format";
import { SkeletonRows } from "@/components/SkeletonRows";

export const Route = createFileRoute("/tickers/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol.toUpperCase()} — CongressTrade Intelligence` },
      {
        name: "description",
        content: `Congressional trading activity and clusters for ${params.symbol.toUpperCase()}.`,
      },
    ],
  }),
  component: TickerDetail,
});

function TickerDetail() {
  const { symbol } = Route.useParams();
  const { data: t, isLoading } = useQuery({
    queryKey: ["ticker", symbol],
    queryFn: () => getTicker(symbol),
  });

  if (isLoading || !t)
    return (
      <div className="p-4">
        <SkeletonRows rows={10} cols={6} />
      </div>
    );

  const last = t.ohlc[t.ohlc.length - 1];
  const first = t.ohlc[0];
  const ret = (last.c / first.c - 1) * 100;

  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-[11px] text-[var(--warning)]">
        <strong className="font-medium uppercase tracking-wider">Demo data</strong> — the
        ticker-detail backend endpoint is not implemented yet. The price chart, holdings, and
        activity rows below are sample fixtures. Real trades for this symbol live on the member
        detail pages.
      </div>
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex items-baseline gap-3">
          <h1 className="num text-3xl font-medium text-[var(--text-primary)]">{t.symbol}</h1>
          <span className="text-sm text-[var(--text-secondary)]">{t.company_name}</span>
          <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-secondary)]">
            {t.sector}
          </span>
          <div className="ml-auto flex items-baseline gap-3">
            <div className="num text-2xl text-[var(--text-primary)]">${last.c.toFixed(2)}</div>
            <div className={"num text-sm " + signClass(ret)}>
              {ret >= 0 ? "+" : ""}
              {ret.toFixed(2)}% 365d
            </div>
          </div>
        </div>
        <div className="mt-3" style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={t.ohlc} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="d"
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                stroke="var(--border)"
                minTickGap={50}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--text-tertiary)" }}
                stroke="var(--border)"
                domain={["auto", "auto"]}
                width={45}
              />
              <RTooltip
                contentStyle={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="c"
                stroke="var(--cyan)"
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {t.active_clusters.length > 0 && (
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
                  <th className="px-3 py-1.5 text-right">Formed</th>
                </tr>
              </thead>
              <tbody>
                {t.active_clusters.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        to="/committees/$id"
                        params={{ id: c.committee_id }}
                        className="text-[var(--text-primary)] hover:underline"
                      >
                        {c.committee_name}
                      </Link>
                    </td>
                    <td
                      className={
                        "num px-3 py-1.5 text-[10px] uppercase " +
                        (c.direction === "buy"
                          ? "text-[var(--positive)]"
                          : "text-[var(--negative)]")
                      }
                    >
                      {c.direction}
                    </td>
                    <td className="num px-3 py-1.5 text-right">{c.member_count}</td>
                    <td className="px-3 py-1.5 text-right">
                      <RelTime iso={c.formed_at} />
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
          Congressional activity ({t.congressional_activity.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Type</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
                <th className="px-3 py-1.5 text-left">Owner</th>
                <th className="px-3 py-1.5 text-left">Flags</th>
                <th className="px-3 py-1.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {t.congressional_activity.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-1.5">
                    <Link
                      to="/members/$id"
                      params={{ id: tx.member_id }}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {tx.member_name}
                    </Link>
                  </td>
                  <td
                    className={
                      "num px-3 py-1.5 text-[10px] uppercase " +
                      (tx.type === "buy"
                        ? "text-[var(--positive)]"
                        : tx.type === "sell"
                          ? "text-[var(--negative)]"
                          : "text-[var(--text-secondary)]")
                    }
                  >
                    {tx.type}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                    {fmtUSDRange(tx.amount_min, tx.amount_max)}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                    {tx.owner_type}
                  </td>
                  <td className="px-3 py-1.5">
                    <FlagRow flags={tx.flags} />
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getScotusJustice, listScotusHoldings, listScotusTransactions } from "@/api/client";
import { fmtUSD } from "@/lib/format";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scotus/$justice")({
  head: ({ params }) => ({
    meta: [
      { title: `Justice ${params.justice.slice(0, 8)} — CongressTrade Intelligence` },
      {
        name: "description",
        content:
          "Supreme Court justice financial disclosures: holdings, transactions, disclosure history.",
      },
    ],
  }),
  component: JusticeDetail,
});

function JusticeDetail() {
  const { justice } = Route.useParams();

  const justiceQuery = useQuery({
    queryKey: ["scotus-justice", justice],
    queryFn: () => getScotusJustice(justice),
  });
  const holdingsQuery = useQuery({
    queryKey: ["scotus-holdings", justice],
    queryFn: () => listScotusHoldings(justice),
  });
  const transactionsQuery = useQuery({
    queryKey: ["scotus-transactions", justice],
    queryFn: () => listScotusTransactions(justice),
  });

  const j = justiceQuery.data;
  const holdings = holdingsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  const filingYears = Array.from(
    new Set(
      [...holdings.map((h) => h.filing_year), ...transactions.map((t) => t.filing_year)].filter(
        (y) => y != null,
      ),
    ),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            <Link to="/scotus" className="hover:underline">
              SCOTUS
            </Link>{" "}
            / {j?.full_name ?? "—"}
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            {j?.seat_title ?? "—"} · {j?.current_status ?? "—"}
          </p>
        </div>
        <p className="num text-[10px] text-[var(--text-tertiary)]">
          {filingYears.length > 0
            ? `disclosure years ${filingYears.join(", ")}`
            : "no disclosures on record"}
        </p>
      </div>

      {justiceQuery.isLoading ? (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <SkeletonRows rows={2} cols={4} />
        </div>
      ) : !j ? (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 text-xs text-[var(--text-tertiary)]">
          Justice not found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Appointed"
            value={String(j.appointed_year ?? "—")}
            sub={j.appointed_by_president ?? undefined}
          />
          <Stat
            label="Disclosures"
            value={String(j.disclosure_count ?? 0)}
            sub="lifetime filings"
          />
          <Stat
            label="Most recent"
            value={String(j.most_recent_disclosure_year ?? "—")}
            sub="filing year"
          />
          <Stat
            label="Holdings"
            value={String(holdings.length)}
            sub={`${transactions.length} txns`}
          />
        </div>
      )}

      {/* Holdings */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <span>Holdings</span>
          <span className="num text-[var(--text-tertiary)]">{holdings.length} on record</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Asset</th>
                <th className="px-3 py-1.5 text-left">Category</th>
                <th className="px-3 py-1.5 text-left">Ticker</th>
                <th className="px-3 py-1.5 text-right">Value range</th>
                <th className="px-3 py-1.5 text-right">Year</th>
              </tr>
            </thead>
            <tbody>
              {holdingsQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="p-3">
                    <SkeletonRows rows={6} cols={5} />
                  </td>
                </tr>
              )}
              {!holdingsQuery.isLoading && holdings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                    No holdings disclosed.
                  </td>
                </tr>
              )}
              {holdings.map((h, i) => (
                <tr
                  key={`${h.asset_name}-${h.filing_year}-${i}`}
                  className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-1.5 text-[var(--text-primary)]">{h.asset_name}</td>
                  <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                    {h.asset_category}
                  </td>
                  <td className="px-3 py-1.5">
                    {h.ticker ? (
                      <Link
                        to="/tickers/$symbol"
                        params={{ symbol: h.ticker }}
                        className="num text-[var(--cyan)] hover:underline"
                      >
                        {h.ticker}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                    <ValueRange low={h.value_range_low} high={h.value_range_high} />
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-tertiary)]">
                    {h.filing_year}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <span>Transactions</span>
          <span className="num text-[var(--text-tertiary)]">{transactions.length} on record</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Date</th>
                <th className="px-3 py-1.5 text-left">Asset</th>
                <th className="px-3 py-1.5 text-left">Ticker</th>
                <th className="px-3 py-1.5 text-left">Side</th>
                <th className="px-3 py-1.5 text-right">Value range</th>
                <th className="px-3 py-1.5 text-right">Year</th>
              </tr>
            </thead>
            <tbody>
              {transactionsQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="p-3">
                    <SkeletonRows rows={6} cols={6} />
                  </td>
                </tr>
              )}
              {!transactionsQuery.isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--text-tertiary)]">
                    No transactions disclosed.
                  </td>
                </tr>
              )}
              {transactions.map((t, i) => (
                <tr
                  key={`${t.asset_name}-${t.transaction_date_approximate}-${i}`}
                  className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                >
                  <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">
                    {t.transaction_date_approximate ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--text-primary)]">{t.asset_name}</td>
                  <td className="px-3 py-1.5">
                    {t.ticker ? (
                      <Link
                        to="/tickers/$symbol"
                        params={{ symbol: t.ticker }}
                        className="num text-[var(--cyan)] hover:underline"
                      >
                        {t.ticker}
                      </Link>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <DirectionChip d={t.transaction_type} />
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                    <ValueRange low={t.value_range_low} high={t.value_range_high} />
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-tertiary)]">
                    {t.filing_year}
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className="num mt-1 text-base text-[var(--text-primary)]">{value}</div>
      {sub && <div className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]">{sub}</div>}
    </div>
  );
}

function ValueRange({
  low,
  high,
}: {
  low: number | string | null | undefined;
  high: number | string | null | undefined;
}) {
  const a = low != null ? Number(low) : null;
  const b = high != null ? Number(high) : null;
  if (a == null && b == null) return <span className="text-[var(--text-tertiary)]">—</span>;
  if (a != null && b != null) {
    return (
      <>
        {fmtUSD(a, { compact: true })}–{fmtUSD(b, { compact: true })}
      </>
    );
  }
  return <>{fmtUSD((a ?? b)!, { compact: true })}+</>;
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
  return <span className={cn("num text-[10px] uppercase", cls)}>{u}</span>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { getBacktestRun, listBacktestPresets, listBacktestTrades, runBacktest } from "@/api/client";
import type {
  BacktestPreset,
  BacktestRunRequest,
  BacktestRunResponse,
  BacktestTradeOut,
} from "@/api/types";
import { SkeletonRows } from "@/components/SkeletonRows";
import { fmtPctRaw, fmtUSD, signClass } from "@/lib/format";

export const Route = createFileRoute("/backtest")({
  head: () => ({
    meta: [
      { title: "Backtest — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "Run the four canonical reference strategies and surface the platform's empirically validated Sharpe 0.678 finding.",
      },
    ],
  }),
  component: BacktestPage,
});

// Per-preset latest run_id, kept in component state so the page can replay a
// finished run without re-executing it. Cleared on hard refresh — the
// authoritative store is `backtest_runs` on the backend (POST is idempotent
// up to the same window + seed, so re-running produces the same Sharpe).
type RunMap = Record<string, string | undefined>;

function BacktestPage() {
  const qc = useQueryClient();
  const presetsQ = useQuery({
    queryKey: ["backtest-presets"],
    queryFn: listBacktestPresets,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const [runs, setRuns] = useState<RunMap>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const runMutation = useMutation({
    mutationFn: async (req: BacktestRunRequest) => {
      const result = await runBacktest(req);
      // Prime the per-run cache so the detail view doesn't refetch.
      qc.setQueryData(["backtest-run", result.run_id], result);
      return result;
    },
    onSuccess: (result, req) => {
      setRuns((m) => ({ ...m, [req.strategy]: result.run_id }));
      setSelectedKey(req.strategy);
    },
  });

  const presets = presetsQ.data ?? [];
  const headline = presets.find((p) => p.headline);
  const nullBaseline = presets.find((p) => p.is_null_baseline);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Backtest
        </h1>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Four canonical reference strategies. The headline result (Q1&nbsp;vote-trade
          inconsistency) reproduces the platform's empirically validated Sharpe&nbsp;0.678 finding
          (SPEC&nbsp;§17). Re-run any preset to confirm the numbers against fresh data — the alert
          layer's measured edge is the Sharpe gap vs the null baseline.
        </p>
      </header>

      {presetsQ.isLoading && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <SkeletonRows rows={4} cols={1} />
        </div>
      )}

      {presetsQ.error && (
        <div className="rounded border border-[var(--negative)]/40 bg-[var(--bg-1)] p-4 text-xs text-[var(--negative)]">
          Failed to load presets: {(presetsQ.error as Error).message}
        </div>
      )}

      {presets.length > 0 && (
        <PresetGrid
          presets={presets}
          runs={runs}
          selectedKey={selectedKey}
          isRunning={runMutation.isPending ? (runMutation.variables?.strategy ?? null) : null}
          runError={runMutation.error ? `${(runMutation.error as Error).message}` : null}
          onRun={(p) =>
            runMutation.mutate({
              strategy: p.key,
              start_date: p.default_start_date,
              end_date: p.default_end_date,
              hold_days: p.default_hold_days,
            })
          }
          onSelect={(k) => setSelectedKey(k)}
        />
      )}

      {headline && nullBaseline && Object.keys(runs).length >= 2 && (
        <ComparisonPanel
          presets={presets}
          runs={runs}
          headlineKey={headline.key}
          nullBaselineKey={nullBaseline.key}
        />
      )}

      {selectedKey && runs[selectedKey] && (
        <RunDetail
          runId={runs[selectedKey] as string}
          preset={presets.find((p) => p.key === selectedKey) ?? null}
        />
      )}
    </div>
  );
}

// ---------- Preset grid ----------
function PresetGrid({
  presets,
  runs,
  selectedKey,
  isRunning,
  runError,
  onRun,
  onSelect,
}: {
  presets: BacktestPreset[];
  runs: RunMap;
  selectedKey: string | null;
  isRunning: string | null;
  runError: string | null;
  onRun: (p: BacktestPreset) => void;
  onSelect: (k: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        Preset strategies
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {presets.map((p) => (
          <PresetCard
            key={p.key}
            preset={p}
            runId={runs[p.key]}
            isSelected={selectedKey === p.key}
            isRunning={isRunning === p.key}
            onRun={() => onRun(p)}
            onSelect={() => onSelect(p.key)}
          />
        ))}
      </div>
      {runError && <div className="text-[11px] text-[var(--negative)]">Run failed: {runError}</div>}
    </section>
  );
}

function PresetCard({
  preset,
  runId,
  isSelected,
  isRunning,
  onRun,
  onSelect,
}: {
  preset: BacktestPreset;
  runId: string | undefined;
  isSelected: boolean;
  isRunning: boolean;
  onRun: () => void;
  onSelect: () => void;
}) {
  const qc = useQueryClient();
  const cached = runId ? qc.getQueryData<BacktestRunResponse>(["backtest-run", runId]) : undefined;
  const sharpe = cached?.metrics?.sharpe ?? null;

  return (
    <div
      className={clsx(
        "relative rounded border bg-[var(--bg-1)] p-3 transition",
        preset.headline
          ? "border-[var(--cyan)]/40 shadow-[0_0_0_1px_var(--cyan)]/10"
          : "border-[var(--border)]",
        isSelected && "ring-1 ring-[var(--cyan)]",
      )}
    >
      {preset.headline && (
        <div className="absolute -top-2 left-3 rounded bg-[var(--cyan)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-black">
          Headline
        </div>
      )}
      {preset.is_null_baseline && (
        <div className="absolute -top-2 left-3 rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
          Control
        </div>
      )}

      <div className="mt-1 text-xs text-[var(--text-primary)]">{preset.name}</div>
      <p className="mt-1 text-[10px] leading-snug text-[var(--text-tertiary)]">
        {preset.description}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-2 text-[10px]">
        <div>
          <div className="uppercase text-[var(--text-tertiary)]">Ref. Sharpe</div>
          <div className="num text-sm text-[var(--text-primary)]">
            {preset.reference.sharpe == null ? "—" : preset.reference.sharpe.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="uppercase text-[var(--text-tertiary)]">Ref. return</div>
          <div
            className={clsx(
              "num text-sm",
              preset.reference.total_return == null
                ? "text-[var(--text-tertiary)]"
                : signClass(preset.reference.total_return),
            )}
          >
            {preset.reference.total_return == null
              ? "—"
              : fmtPctRaw(preset.reference.total_return * 100, 1)}
          </div>
        </div>
        <div>
          <div className="uppercase text-[var(--text-tertiary)]">Trades</div>
          <div className="num text-xs text-[var(--text-secondary)]">
            {preset.reference.n_trades.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="uppercase text-[var(--text-tertiary)]">Win rate</div>
          <div className="num text-xs text-[var(--text-secondary)]">
            {preset.reference.win_rate == null
              ? "—"
              : `${(preset.reference.win_rate * 100).toFixed(1)}%`}
          </div>
        </div>
      </div>

      {sharpe != null && (
        <div className="mt-2 rounded bg-[var(--bg-2)] px-2 py-1 text-[10px]">
          <span className="text-[var(--text-tertiary)]">Last run</span>{" "}
          <span className="num text-[var(--cyan)]">{sharpe.toFixed(3)}</span>{" "}
          <span className="text-[var(--text-tertiary)]">Sharpe</span>
        </div>
      )}

      <div className="mt-3 flex gap-1">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className={clsx(
            "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition",
            preset.headline
              ? "bg-[var(--cyan)] text-black hover:bg-[var(--cyan)]/85 disabled:bg-[var(--cyan)]/40"
              : "bg-[var(--bg-2)] text-[var(--text-primary)] ring-1 ring-[var(--border)] hover:bg-[var(--bg-0)] disabled:opacity-60",
          )}
        >
          {isRunning ? "Running…" : runId ? "Re-run" : "Run backtest"}
        </button>
        {runId && (
          <button
            type="button"
            onClick={onSelect}
            className="rounded bg-[var(--bg-2)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)]"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Comparison panel ----------
function ComparisonPanel({
  presets,
  runs,
  headlineKey,
  nullBaselineKey,
}: {
  presets: BacktestPreset[];
  runs: RunMap;
  headlineKey: string;
  nullBaselineKey: string;
}) {
  const qc = useQueryClient();
  const rows = useMemo(() => {
    return presets
      .filter((p) => runs[p.key])
      .map((p) => {
        const run = qc.getQueryData<BacktestRunResponse>(["backtest-run", runs[p.key] as string]);
        return { preset: p, run };
      })
      .filter((r): r is { preset: BacktestPreset; run: BacktestRunResponse } => Boolean(r.run));
  }, [presets, runs, qc]);

  if (rows.length < 2) return null;

  const headlineRow = rows.find((r) => r.preset.key === headlineKey);
  const nullRow = rows.find((r) => r.preset.key === nullBaselineKey);

  const headlineSharpe = headlineRow?.run.metrics?.sharpe ?? null;
  const nullSharpe = nullRow?.run.metrics?.sharpe ?? null;
  const sharpeGap =
    headlineSharpe != null && nullSharpe != null ? headlineSharpe - nullSharpe : null;

  const headlineReturn = headlineRow?.run.metrics?.total_return ?? null;
  const nullReturn = nullRow?.run.metrics?.total_return ?? null;
  const returnGap =
    headlineReturn != null && nullReturn != null ? headlineReturn - nullReturn : null;

  return (
    <section className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        Comparison
      </div>
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">Strategy</th>
              <th className="px-3 py-1.5 text-right">n_trades</th>
              <th className="px-3 py-1.5 text-right">Total return</th>
              <th className="px-3 py-1.5 text-right">Sharpe</th>
              <th className="px-3 py-1.5 text-right">Sortino</th>
              <th className="px-3 py-1.5 text-right">Max DD</th>
              <th className="px-3 py-1.5 text-right">Win rate</th>
              <th className="px-3 py-1.5 text-right">Avg hold</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ preset, run }) => (
              <tr
                key={preset.key}
                className={clsx(
                  "border-b border-[var(--border)]/40",
                  preset.headline && "bg-[var(--cyan)]/5",
                  preset.is_null_baseline && "bg-[var(--bg-2)]/40",
                )}
              >
                <td className="px-3 py-1.5 text-[var(--text-primary)]">{preset.name}</td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                  {run.metrics?.n_trades ?? 0}
                </td>
                <td
                  className={clsx(
                    "num px-3 py-1.5 text-right",
                    run.metrics?.total_return != null && signClass(run.metrics.total_return),
                  )}
                >
                  {run.metrics?.total_return != null
                    ? fmtPctRaw(run.metrics.total_return * 100)
                    : "—"}
                </td>
                <td
                  className={clsx(
                    "num px-3 py-1.5 text-right",
                    preset.headline && "text-[var(--cyan)]",
                  )}
                >
                  {run.metrics?.sharpe?.toFixed(3) ?? "—"}
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                  {run.metrics?.sortino?.toFixed(3) ?? "—"}
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--negative)]">
                  {run.metrics ? `-${(run.metrics.max_drawdown * 100).toFixed(2)}%` : "—"}
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                  {run.metrics ? `${(run.metrics.win_rate * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                  {run.metrics ? `${run.metrics.avg_holding_days.toFixed(0)}d` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sharpeGap != null && (
          <div className="border-t border-[var(--cyan)]/30 bg-[var(--cyan)]/5 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--cyan)]">
              Empirical edge
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-6">
              <div>
                <div className="num text-3xl text-[var(--cyan)]">
                  {sharpeGap >= 0 ? "+" : ""}
                  {sharpeGap.toFixed(2)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  Sharpe gap (headline − null)
                </div>
              </div>
              {returnGap != null && (
                <div>
                  <div
                    className={clsx(
                      "num text-2xl",
                      returnGap >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]",
                    )}
                  >
                    {returnGap >= 0 ? "+" : ""}
                    {(returnGap * 100).toFixed(1)}pp
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Return gap
                  </div>
                </div>
              )}
              <p className="max-w-md text-[11px] leading-snug text-[var(--text-secondary)]">
                The alert layer's measured value-add over Q1-leaderboard universe selection alone.
                Same window, same hold period, same universe — the only difference is the
                VOTE_TRADE_INCONSISTENCY alert filter.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- Run detail ----------
function RunDetail({ runId, preset }: { runId: string; preset: BacktestPreset | null }) {
  const runQ = useQuery({
    queryKey: ["backtest-run", runId],
    queryFn: () => getBacktestRun(runId),
    staleTime: Infinity,
  });
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const tradesQ = useQuery({
    queryKey: ["backtest-trades", runId, limit, offset],
    queryFn: () => listBacktestTrades(runId, { limit, offset }),
    staleTime: Infinity,
  });

  const run = runQ.data;
  const metrics = run?.metrics;
  const sharpe = metrics?.sharpe ?? null;
  const isHeadline = preset?.headline ?? false;
  const sharpeDeltaFromRef =
    metrics && preset?.reference.sharpe != null
      ? (metrics.sharpe ?? 0) - preset.reference.sharpe
      : null;

  return (
    <section className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        Run detail · <span className="num">{runId.slice(0, 8)}</span>
      </div>

      <div
        className={clsx(
          "rounded border bg-[var(--bg-1)] p-4",
          isHeadline ? "border-[var(--cyan)]/40" : "border-[var(--border)]",
        )}
      >
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Annualized Sharpe
            </div>
            <div
              className={clsx(
                "num mt-1 text-5xl tracking-tight",
                isHeadline ? "text-[var(--cyan)]" : "text-[var(--text-primary)]",
                sharpe == null && "text-[var(--text-tertiary)]",
              )}
            >
              {sharpe == null ? "—" : sharpe.toFixed(3)}
            </div>
            {preset?.reference.sharpe != null && metrics && (
              <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                Reference {preset.reference.sharpe.toFixed(2)}{" "}
                {sharpeDeltaFromRef != null && (
                  <span
                    className={clsx(
                      "num",
                      Math.abs(sharpeDeltaFromRef) <= 0.02
                        ? "text-[var(--positive)]"
                        : "text-[var(--warning)]",
                    )}
                  >
                    (Δ {sharpeDeltaFromRef >= 0 ? "+" : ""}
                    {sharpeDeltaFromRef.toFixed(3)})
                  </span>
                )}
              </div>
            )}
          </div>

          {isHeadline && sharpe != null && (
            <div className="rounded bg-[var(--cyan)]/10 px-3 py-2 text-[11px] text-[var(--cyan)] ring-1 ring-[var(--cyan)]/30">
              Platform's load-bearing finding — SPEC §17.
              <br />
              Re-running reproduces the validated empirical edge.
            </div>
          )}
        </div>

        {metrics && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Total return"
              value={fmtPctRaw(metrics.total_return * 100)}
              cls={signClass(metrics.total_return)}
            />
            <Stat
              label="Annualized return"
              value={fmtPctRaw(metrics.annualized_return * 100)}
              cls={signClass(metrics.annualized_return)}
            />
            <Stat label="Sortino" value={metrics.sortino?.toFixed(2) ?? "—"} />
            <Stat
              label="Max drawdown"
              value={`-${(metrics.max_drawdown * 100).toFixed(2)}%`}
              cls="text-[var(--negative)]"
            />
            <Stat label="n_trades" value={metrics.n_trades.toLocaleString()} />
            <Stat label="Winners / losers" value={`${metrics.n_winners} / ${metrics.n_losers}`} />
            <Stat label="Win rate" value={`${(metrics.win_rate * 100).toFixed(1)}%`} />
            <Stat label="Final equity" value={fmtUSD(parseFloat(metrics.final_equity))} />
          </div>
        )}

        {run && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[var(--border)] pt-2 text-[10px] text-[var(--text-tertiary)]">
            <div>
              Window <span className="num text-[var(--text-secondary)]">{run.start_date}</span> →{" "}
              <span className="num text-[var(--text-secondary)]">{run.end_date}</span>
            </div>
            <div>
              Initial capital{" "}
              <span className="num text-[var(--text-secondary)]">
                {fmtUSD(parseFloat(run.initial_capital))}
              </span>
            </div>
            <div>
              Strategy <span className="num text-[var(--text-secondary)]">{run.strategy_name}</span>
            </div>
            <div>
              Status <span className="num text-[var(--text-secondary)]">{run.status}</span>
            </div>
          </div>
        )}
      </div>

      <TradesTable
        loading={tradesQ.isLoading}
        items={tradesQ.data?.items ?? []}
        total={tradesQ.data?.total ?? 0}
        limit={limit}
        offset={offset}
        onOffset={setOffset}
      />
    </section>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </div>
      <div className={clsx("num mt-1 text-base", cls ?? "text-[var(--text-primary)]")}>{value}</div>
    </div>
  );
}

function TradesTable({
  loading,
  items,
  total,
  limit,
  offset,
  onOffset,
}: {
  loading: boolean;
  items: BacktestTradeOut[];
  total: number;
  limit: number;
  offset: number;
  onOffset: (n: number) => void;
}) {
  const hasMore = offset + items.length < total;

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Trades
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          {total > 0 && (
            <>
              <span className="num">{Math.min(offset + 1, total)}</span>–
              <span className="num">{Math.min(offset + items.length, total)}</span> of{" "}
              <span className="num">{total.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
      {loading ? (
        <div className="p-3">
          <SkeletonRows rows={6} cols={6} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-[var(--text-tertiary)]">
          No trades persisted for this run.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">Ticker</th>
              <th className="px-3 py-1.5 text-left">Member</th>
              <th className="px-3 py-1.5 text-left">Entry</th>
              <th className="px-3 py-1.5 text-left">Exit</th>
              <th className="px-3 py-1.5 text-right">Entry px</th>
              <th className="px-3 py-1.5 text-right">Exit px</th>
              <th className="px-3 py-1.5 text-right">P&amp;L</th>
              <th className="px-3 py-1.5 text-right">Return</th>
              <th className="px-3 py-1.5 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                <td className="num px-3 py-1.5 text-[var(--cyan)]">
                  {t.ticker_symbol ?? t.ticker_id.slice(0, 8)}
                </td>
                <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                  {t.official_name ?? "—"}
                </td>
                <td className="num px-3 py-1.5 text-[var(--text-secondary)]">{t.entry_date}</td>
                <td className="num px-3 py-1.5 text-[var(--text-secondary)]">{t.exit_date}</td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-tertiary)]">
                  {parseFloat(t.entry_price).toFixed(2)}
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-tertiary)]">
                  {parseFloat(t.exit_price).toFixed(2)}
                </td>
                <td className={clsx("num px-3 py-1.5 text-right", signClass(parseFloat(t.pnl)))}>
                  {fmtUSD(parseFloat(t.pnl))}
                </td>
                <td className={clsx("num px-3 py-1.5 text-right", signClass(t.return_pct))}>
                  {fmtPctRaw(t.return_pct * 100)}
                </td>
                <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                  {t.source_alert_id
                    ? `alert #${t.source_alert_id}`
                    : t.source_transaction_id
                      ? `tx #${t.source_transaction_id}`
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(offset > 0 || hasMore) && (
        <div className="flex items-center justify-end gap-1 border-t border-[var(--border)] px-3 py-2 text-[11px]">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => onOffset(Math.max(0, offset - limit))}
            className="rounded px-2 py-0.5 text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => onOffset(offset + limit)}
            className="rounded px-2 py-0.5 text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

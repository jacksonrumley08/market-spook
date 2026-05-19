import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { listBacktestPresets } from "@/api/client";

// Surfaces the platform's load-bearing empirical claim — Slice-10 headline
// Sharpe vs the null baseline — directly on the home dashboard. The harsh-
// client audit's hedge-fund-analyst persona (P0 #2) flagged this number as
// "buried at /backtest" while every other home widget showed unjustified
// counts. Now it's the first thing a paying-customer eye lands on.
//
// Reads from /backtest/presets `reference` blocks so the number stays in
// sync with the canonical Slice-10 result without re-running on every
// dashboard load.
export function EmpiricalEdge() {
  const { data } = useQuery({
    queryKey: ["backtest-presets"],
    queryFn: listBacktestPresets,
  });

  const headline = data?.find((p) => p.headline);
  const baseline = data?.find((p) => p.is_null_baseline);
  const headRef = headline?.reference;
  const baseRef = baseline?.reference;

  const sharpe = headRef?.sharpe;
  const baselineSharpe = baseRef?.sharpe;
  const sharpeDelta =
    sharpe != null && baselineSharpe != null ? sharpe - baselineSharpe : null;

  const totalReturn = headRef?.total_return;
  const baselineReturn = baseRef?.total_return;
  const returnDelta =
    totalReturn != null && baselineReturn != null ? totalReturn - baselineReturn : null;

  return (
    <div className="rounded border border-[var(--cyan)]/30 bg-[var(--cyan)]/[0.03] p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-[var(--cyan)]" />
          Empirical edge — Slice-10 backtest
        </span>
        <Link to="/backtest" className="text-[var(--cyan)] hover:underline">
          run it →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Sharpe
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="num text-2xl font-medium text-[var(--text-primary)]">
              {sharpe != null ? sharpe.toFixed(3) : "—"}
            </span>
            {sharpeDelta != null && (
              <span className="num text-[10px] text-[var(--positive)]">
                +{sharpeDelta.toFixed(2)} vs null
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            Total return
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="num text-2xl font-medium text-[var(--text-primary)]">
              {totalReturn != null ? `${(totalReturn * 100).toFixed(1)}%` : "—"}
            </span>
            {returnDelta != null && (
              <span className="num text-[10px] text-[var(--positive)]">
                +{(returnDelta * 100).toFixed(1)}pp
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
            n trades
          </div>
          <div className="num mt-0.5 text-2xl font-medium text-[var(--text-primary)]">
            {headRef?.n_trades ?? "—"}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        {headline?.description ??
          "Top-quartile leaderboard members' VOTE_TRADE_INCONSISTENCY alerts."}{" "}
        Held {headline?.default_hold_days ?? 90}d. Net of 10 bps assumed slippage; no
        commissions/taxes/market-impact modeled. Headline + null-baseline numbers are
        Slice-10 reference values; replay against current data on /backtest to verify
        no drift.
      </p>
    </div>
  );
}

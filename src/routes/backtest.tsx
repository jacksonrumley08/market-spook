import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { listMembers, runBacktest } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { fmtPctRaw, signClass } from '@/lib/format';
import type { BacktestResult } from '@/api/types';

export const Route = createFileRoute('/backtest')({
  head: () => ({
    meta: [
      { title: 'Backtest replica — CongressTrade Intelligence' },
      { name: 'description', content: 'Replicate a member\u2019s trades with configurable lag and date range.' },
    ],
  }),
  component: BacktestPage,
});

function BacktestPage() {
  const { data: members } = useQuery({ queryKey: ['members-bt'], queryFn: () => listMembers({ limit: 999 }) });
  const [memberId, setMemberId] = useState<string>('');
  const [lag, setLag] = useState(7);
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const [start, setStart] = useState(yearAgo);
  const [end, setEnd] = useState(today);

  const mut = useMutation({
    mutationFn: () => runBacktest({ member_id: memberId || (members?.items[0]?.id ?? ''), lag_days: lag, start_date: start, end_date: end }),
  });

  const result = mut.data;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Backtest replica</h1>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-4 rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Member</label>
            <select
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              className="mt-1 h-8 w-full rounded border border-[var(--border)] bg-[var(--bg-2)] px-2 text-xs text-[var(--text-primary)]"
            >
              <option value="">— select —</option>
              {members?.items.map(m => <option key={m.id} value={m.id}>{m.name} ({m.party}·{m.state})</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Lag days</label>
              <span className="num text-xs text-[var(--text-primary)]">{lag}d</span>
            </div>
            <Slider value={[lag]} min={0} max={45} step={1} onValueChange={v => setLag(v[0])} className="mt-2" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Start</label>
              <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-8 border-[var(--border)] bg-[var(--bg-2)] text-xs" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">End</label>
              <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-8 border-[var(--border)] bg-[var(--bg-2)] text-xs" />
            </div>
          </div>

          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="w-full bg-[var(--cyan)] text-black hover:bg-[var(--cyan)]/80"
          >
            {mut.isPending ? 'Running…' : 'Run backtest'}
          </Button>
        </div>

        <div className="col-span-8 space-y-3">
          {!result && (
            <div className="rounded border border-dashed border-[var(--border)] bg-[var(--bg-1)] p-12 text-center text-xs text-[var(--text-tertiary)]">
              {mut.isPending ? 'Computing…' : 'Configure parameters and run a backtest.'}
            </div>
          )}
          {result && <Results r={result} />}
        </div>
      </div>
    </div>
  );
}

function Results({ r }: { r: BacktestResult }) {
  return (
    <>
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Cumulative return</div>
        <div className="mt-2" style={{ height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={r.cumulative} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} stroke="var(--border)" minTickGap={50} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} stroke="var(--border)" width={40} />
              <RTooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 11 }} />
              <Line type="monotone" dataKey="v" stroke="var(--cyan)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Total return" value={fmtPctRaw(r.total_return * 100)} cls={signClass(r.total_return)} />
        <Stat label="Sharpe" value={r.sharpe.toFixed(2)} />
        <Stat label="Max drawdown" value={fmtPctRaw(r.max_drawdown * 100)} cls="text-[var(--negative)]" />
        <Stat label="Win rate" value={`${(r.win_rate * 100).toFixed(1)}%`} />
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Position log</div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">Ticker</th>
              <th className="px-3 py-1.5 text-left">Side</th>
              <th className="px-3 py-1.5 text-left">Entry</th>
              <th className="px-3 py-1.5 text-left">Exit</th>
              <th className="px-3 py-1.5 text-right">Return</th>
            </tr>
          </thead>
          <tbody>
            {r.positions.map(p => (
              <tr key={p.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                <td className="num px-3 py-1.5 text-[var(--cyan)]">{p.ticker}</td>
                <td className={'num px-3 py-1.5 text-[10px] uppercase ' + (p.side === 'long' ? 'text-[var(--positive)]' : 'text-[var(--negative)]')}>{p.side}</td>
                <td className="num px-3 py-1.5 text-[var(--text-secondary)]">{p.entry_date.slice(0, 10)}</td>
                <td className="num px-3 py-1.5 text-[var(--text-secondary)]">{p.exit_date.slice(0, 10)}</td>
                <td className={'num px-3 py-1.5 text-right ' + signClass(p.return_pct)}>{fmtPctRaw(p.return_pct * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
      <div className={'num mt-1 text-xl ' + (cls ?? 'text-[var(--text-primary)]')}>{value}</div>
    </div>
  );
}

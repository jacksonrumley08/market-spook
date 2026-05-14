import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
type LBKind = 'alpha' | 'hit_rate' | 'vagueness' | 'late_filer' | 'options_conviction' | 'filing_quality';
const KINDS: LBKind[] = ['alpha','hit_rate','vagueness','late_filer','options_conviction','filing_quality'];
import { getLeaderboard } from '@/api/client';
import type { LeaderboardKind } from '@/api/types-ui';
import { Sparkline } from '@/components/Sparkline';
import { PartyChip } from '@/components/PartyChip';
import { fmtPctRaw, signClass } from '@/lib/format';
import { SkeletonRows } from '@/components/SkeletonRows';
import { cn } from '@/lib/utils';

const TABS: { kind: LeaderboardKind; label: string; fmt: (v: number) => string; cls?: (v: number) => string }[] = [
  { kind: 'alpha', label: 'Alpha', fmt: v => fmtPctRaw(v), cls: signClass },
  { kind: 'hit_rate', label: 'Hit rate', fmt: v => `${(v * 100).toFixed(1)}%` },
  { kind: 'vagueness', label: 'Vagueness', fmt: v => `${(v * 100).toFixed(1)}%`, cls: v => v > 0.4 ? 'text-[var(--warning)]' : '' },
  { kind: 'late_filer', label: 'Late filer', fmt: v => `${(v * 100).toFixed(0)}`, cls: v => v > 0.3 ? 'text-[var(--warning)]' : '' },
  { kind: 'options_conviction', label: 'Options conviction', fmt: v => `${(v * 100).toFixed(0)}` },
  { kind: 'filing_quality', label: 'Filing quality', fmt: v => `${(v * 100).toFixed(0)}` },
];

export const Route = createFileRoute('/leaderboards')({
  validateSearch: (s: Record<string, unknown>): { tab: LBKind } => {
    const t = s.tab as LBKind;
    return { tab: KINDS.includes(t) ? t : 'alpha' };
  },
  head: () => ({
    meta: [
      { title: 'Leaderboards — CongressTrade Intelligence' },
      { name: 'description', content: 'Member rankings by alpha, hit rate, vagueness, lateness, and conviction.' },
    ],
  }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: '/leaderboards' });
  const { data, isLoading } = useQuery({ queryKey: ['leaderboard', tab], queryFn: () => getLeaderboard(tab) });
  const meta = TABS.find(t => t.kind === tab)!;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Leaderboards</h1>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(t => (
          <button
            key={t.kind}
            onClick={() => navigate({ search: { tab: t.kind } })}
            className={cn(
              'border-b-2 px-3 py-1.5 text-xs uppercase tracking-wider transition-colors -mb-px',
              tab === t.kind
                ? 'border-[var(--cyan)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">#</th>
              <th className="px-3 py-1.5 text-left">Δ</th>
              <th className="px-3 py-1.5 text-left">Member</th>
              <th className="px-3 py-1.5 text-left">Aff.</th>
              <th className="px-3 py-1.5 text-right">Score</th>
              <th className="px-3 py-1.5 text-right">30d</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-3"><SkeletonRows rows={10} cols={6} /></td></tr>}
            {data?.map(r => (
              <tr key={r.member_id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">{r.rank}</td>
                <td className={'num px-3 py-1.5 text-[10px] ' + signClass(r.rank_delta)}>{r.rank_delta > 0 ? `↑${r.rank_delta}` : r.rank_delta < 0 ? `↓${Math.abs(r.rank_delta)}` : '—'}</td>
                <td className="px-3 py-1.5"><Link to="/members/$id" params={{ id: r.member_id }} className="text-[var(--text-primary)] hover:underline">{r.member_name}</Link></td>
                <td className="px-3 py-1.5"><PartyChip party={r.party} state={r.state} chamber={r.chamber} /></td>
                <td className={'num px-3 py-1.5 text-right ' + (meta.cls?.(r.score) ?? 'text-[var(--text-primary)]')}>{meta.fmt(r.score)}</td>
                <td className="px-3 py-1.5 text-right"><Sparkline data={r.series_30d} width={70} height={18} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

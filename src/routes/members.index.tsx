import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listMembers } from '@/api/client';
import { Sparkline } from '@/components/Sparkline';
import { PartyChip } from '@/components/PartyChip';
import { fmtPctRaw, signClass } from '@/lib/format';
import { SkeletonRows } from '@/components/SkeletonRows';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/members/')({
  head: () => ({
    meta: [
      { title: 'Members — CongressTrade Intelligence' },
      { name: 'description', content: 'All tracked US House and Senate members with composite scores.' },
    ],
  }),
  component: MembersIndex,
});

type SortKey = 'name' | 'alpha_180d' | 'hit_rate' | 'vagueness_rate' | 'lateness_score';

function MembersIndex() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('alpha_180d');
  const [asc, setAsc] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['members', search],
    queryFn: () => listMembers({ search, limit: 999 }),
  });

  const items = [...(data?.items ?? [])].sort((a, b) => {
    const av = sort === 'name' ? a.name : (a.scores as any)[sort];
    const bv = sort === 'name' ? b.name : (b.scores as any)[sort];
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  });

  const Th = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: 'right' }) => (
    <th
      onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(false); } }}
      className={'cursor-pointer select-none px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)] hover:text-[var(--text-primary)] ' + (align === 'right' ? 'text-right' : 'text-left')}
    >
      {children}{sort === k && <span className="ml-1 text-[var(--cyan)]">{asc ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Members</h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">{data?.total ?? 0} tracked</p>
        </div>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or bioguide id…"
          className="h-8 w-72 border-[var(--border)] bg-[var(--bg-1)] text-xs"
        />
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <table className="w-full text-xs">
          <thead className="sticky top-12 z-10 bg-[var(--bg-1)]">
            <tr className="border-b border-[var(--border)]">
              <Th k="name">Member</Th>
              <th className="px-3 py-1.5 text-left text-[10px] uppercase text-[var(--text-tertiary)]">Affiliation</th>
              <Th k="alpha_180d" align="right">α180d</Th>
              <th className="px-3 py-1.5 text-right text-[10px] uppercase text-[var(--text-tertiary)]">α series</th>
              <Th k="hit_rate" align="right">Hit rate</Th>
              <Th k="vagueness_rate" align="right">Vagueness</Th>
              <Th k="lateness_score" align="right">Lateness</Th>
              <th className="px-3 py-1.5 text-left text-[10px] uppercase text-[var(--text-tertiary)]">Committees</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="p-3"><SkeletonRows rows={10} cols={8} /></td></tr>
            )}
            {items.map(m => (
              <tr key={m.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-2)]">
                <td className="px-3 py-1.5">
                  <Link to="/members/$id" params={{ id: m.id }} className="text-[var(--text-primary)] hover:underline">{m.name}</Link>
                </td>
                <td className="px-3 py-1.5"><PartyChip party={m.party} state={m.state} chamber={m.chamber} /></td>
                <td className={'num px-3 py-1.5 text-right ' + signClass(m.scores.alpha_180d)}>{fmtPctRaw(m.scores.alpha_180d)}</td>
                <td className="px-3 py-1.5 text-right"><Sparkline data={m.alpha_series.slice(-30)} width={70} height={18} /></td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">{(m.scores.hit_rate * 100).toFixed(0)}%</td>
                <td className={'num px-3 py-1.5 text-right ' + (m.scores.vagueness_rate > 0.4 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]')}>{(m.scores.vagueness_rate * 100).toFixed(0)}%</td>
                <td className={'num px-3 py-1.5 text-right ' + (m.scores.lateness_score > 0.3 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]')}>{(m.scores.lateness_score * 100).toFixed(0)}</td>
                <td className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] truncate max-w-[260px]">{m.committees.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getCommittee } from '@/api/client';
import { PartyChip } from '@/components/PartyChip';
import { FlagRow } from '@/components/FlagBadge';
import { RelTime } from '@/components/RelTime';
import { fmtPctRaw, fmtUSDRange, signClass } from '@/lib/format';
import { SkeletonRows } from '@/components/SkeletonRows';

export const Route = createFileRoute('/committees/$id')({
  head: ({ params }) => ({
    meta: [
      { title: `Committee ${params.id} — CongressTrade Intelligence` },
      { name: 'description', content: `Roster, weekly sector flow, and recent cluster trades for committee ${params.id}.` },
    ],
  }),
  component: CommitteeDetail,
});

function HeatCell({ v, max }: { v: number; max: number }) {
  const intensity = Math.min(1, Math.abs(v) / max);
  const color = v >= 0 ? `rgba(34,197,94,${intensity})` : `rgba(239,68,68,${intensity})`;
  return (
    <td title={v.toLocaleString()} className="h-5 w-5 border border-[var(--bg-0)]" style={{ background: color || 'var(--bg-2)' }} />
  );
}

function CommitteeDetail() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useQuery({ queryKey: ['committee', id], queryFn: () => getCommittee(id) });

  if (isLoading || !c) return <div className="p-4"><SkeletonRows rows={10} cols={6} /></div>;

  const allCells = c.weekly_flow.flatMap(s => s.weeks.map(w => Math.abs(w.net)));
  const max = Math.max(1, ...allCells);

  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-medium text-[var(--text-primary)]">{c.name}</h1>
          <span className="num rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-secondary)]">{c.chamber}</span>
          <span className="num text-[10px] text-[var(--text-tertiary)]">{c.member_count} members</span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{c.jurisdiction_summary}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {c.jurisdiction_sectors.map(s => (
            <span key={s} className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{s}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Roster */}
        <div className="col-span-5 rounded border border-[var(--border)] bg-[var(--bg-1)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Member roster</div>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Member</th>
                <th className="px-3 py-1.5 text-left">Aff.</th>
                <th className="px-3 py-1.5 text-right">α 180d</th>
              </tr>
            </thead>
            <tbody>
              {c.members.map(m => (
                <tr key={m.member_id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                  <td className="px-3 py-1.5"><Link to="/members/$id" params={{ id: m.member_id }} className="text-[var(--text-primary)] hover:underline">{m.name}</Link></td>
                  <td className="px-3 py-1.5"><PartyChip party={m.party} state={m.state} /></td>
                  <td className={'num px-3 py-1.5 text-right ' + signClass(m.alpha_180d)}>{fmtPctRaw(m.alpha_180d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: heatmap + recent trades */}
        <div className="col-span-7 space-y-3">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Weekly flow heatmap (26w)</div>
            <div className="mt-3 overflow-x-auto">
              <table className="border-separate border-spacing-0">
                <tbody>
                  {c.weekly_flow.map(s => (
                    <tr key={s.sector}>
                      <td className="pr-2 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">{s.sector}</td>
                      {s.weeks.map((w, i) => <HeatCell key={i} v={w.net} max={max} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="num mt-2 flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-[var(--negative)]" /> net sell</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-[var(--positive)]" /> net buy</span>
              <span className="ml-auto">max ${(max/1e6).toFixed(0)}M</span>
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Recent cluster trades</div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-1.5 text-left">Member</th>
                  <th className="px-3 py-1.5 text-left">Ticker</th>
                  <th className="px-3 py-1.5 text-left">Type</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5 text-left">Flags</th>
                  <th className="px-3 py-1.5 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {c.recent_cluster_trades.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                    <td className="px-3 py-1.5"><Link to="/members/$id" params={{ id: t.member_id }} className="text-[var(--text-primary)] hover:underline">{t.member_name}</Link></td>
                    <td className="px-3 py-1.5"><Link to="/tickers/$symbol" params={{ symbol: t.ticker }} className="num text-[var(--cyan)] hover:underline">{t.ticker}</Link></td>
                    <td className={'num px-3 py-1.5 text-[10px] uppercase ' + (t.type === 'buy' ? 'text-[var(--positive)]' : 'text-[var(--negative)]')}>{t.type}</td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmtUSDRange(t.amount_min, t.amount_max)}</td>
                    <td className="px-3 py-1.5"><FlagRow flags={t.flags} /></td>
                    <td className="px-3 py-1.5 text-right"><RelTime iso={t.transaction_date} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Cell, PieChart, Pie } from 'recharts';
import { getMember, listCommittees, listTransactions } from '@/api/client';
import { Sparkline } from '@/components/Sparkline';
import { PartyChip } from '@/components/PartyChip';
import { FlagRow } from '@/components/FlagBadge';
import { RelTime } from '@/components/RelTime';
import { fmtPctRaw, fmtUSDRange, signClass } from '@/lib/format';
import { SkeletonRows } from '@/components/SkeletonRows';

export const Route = createFileRoute('/members/$id')({
  head: ({ params }) => ({
    meta: [
      { title: `Member ${params.id} — CongressTrade Intelligence` },
      { name: 'description', content: `Composite trading scores, holdings, and signal context for member ${params.id}.` },
    ],
  }),
  component: MemberDetail,
});

const SECTOR_COLORS = ['#06b6d4', '#a78bfa', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a3a3a3', '#525252'];

function MemberDetail() {
  const { id } = Route.useParams();
  const { data: member, isLoading } = useQuery({ queryKey: ['member', id], queryFn: () => getMember(id) });
  const { data: txns } = useQuery({ queryKey: ['member-tx', id], queryFn: () => listTransactions({ member_id: id, limit: 50 }) });
  const { data: committees } = useQuery({ queryKey: ['committees-all'], queryFn: listCommittees });

  if (isLoading || !member) {
    return <div className="p-4"><SkeletonRows rows={12} cols={6} /></div>;
  }

  const cmtNames = (committees ?? []).filter(c => member.committees.includes(c.id));

  // Holdings: aggregate by ticker from txns
  const holdings = (txns?.items ?? []).reduce((acc, t) => {
    const sign = t.type === 'buy' ? 1 : t.type === 'sell' ? -1 : 0;
    const mid = (t.amount_min + t.amount_max) / 2;
    const k = t.ticker;
    if (!acc[k]) acc[k] = { ticker: k, net: 0, lastDate: t.transaction_date, count: 0, company: t.company_name ?? '' };
    acc[k].net += sign * mid;
    acc[k].count += 1;
    if (new Date(t.transaction_date) > new Date(acc[k].lastDate)) acc[k].lastDate = t.transaction_date;
    return acc;
  }, {} as Record<string, { ticker: string; net: number; lastDate: string; count: number; company: string }>);
  const holdingsArr = Object.values(holdings).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return (
    <div className="space-y-3">
      {/* Header strip */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-[var(--text-primary)]">{member.name}</h1>
              <PartyChip party={member.party} state={member.state} chamber={member.chamber} />
              {member.district && <span className="num text-[10px] text-[var(--text-tertiary)]">D-{member.district}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cmtNames.map(c => (
                <Link key={c.id} to="/committees/$id" params={{ id: c.id }}
                  className="rounded bg-[var(--bg-2)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--cyan)]">
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="num mt-2 text-[10px] text-[var(--text-tertiary)]">
              {member.tenure_years}y tenure · {member.bioguide_id}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <Score label="α 180d" value={fmtPctRaw(member.scores.alpha_180d)} cls={signClass(member.scores.alpha_180d)} />
            <Score label="Hit rate" value={`${(member.scores.hit_rate * 100).toFixed(0)}%`} />
            <Score label="Filing q." value={`${(member.scores.filing_quality * 100).toFixed(0)}%`} />
            <Score label="Vagueness" value={`${(member.scores.vagueness_rate * 100).toFixed(0)}%`}
              cls={member.scores.vagueness_rate > 0.4 ? 'text-[var(--warning)]' : ''} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Left col */}
        <div className="col-span-5 space-y-3">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Alpha sparklines</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['alpha_30d','alpha_90d','alpha_180d','alpha_365d'] as const).map((k,i) => {
                const periods = ['30d','90d','180d','365d'][i];
                const slice = member.alpha_series.slice(-([30,90,180,180][i]));
                const v = (member.scores as any)[k];
                return (
                  <div key={k} className="rounded bg-[var(--bg-2)] p-2.5">
                    <div className="num text-[10px] text-[var(--text-tertiary)]">α {periods}</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <div className={'num text-sm ' + signClass(v)}>{fmtPctRaw(v)}</div>
                      <Sparkline data={slice} width={80} height={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Sector tilt</div>
            <div className="mt-3 flex items-center gap-4">
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={member.sector_tilt} dataKey="weight" innerRadius={36} outerRadius={64} stroke="var(--bg-1)" strokeWidth={1}>
                      {member.sector_tilt.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1">
                {member.sector_tilt.slice(0, 6).map((s, i) => (
                  <div key={s.sector} className="flex items-center gap-2 text-[11px]">
                    <span className="h-2 w-2 rounded-sm" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                    <span className="flex-1 truncate">{s.sector}</span>
                    <span className="num text-[var(--text-secondary)]">{(s.weight * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Hearing-trade proximity</div>
            <div className="mt-3" style={{ height: 140 }}>
              <ResponsiveContainer>
                <BarChart data={member.hearing_proximity}>
                  <XAxis dataKey="proximity_days" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} stroke="var(--border)" />
                  <YAxis hide />
                  <RTooltip
                    contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 11 }}
                    labelFormatter={(v) => `${v >= 0 ? '+' : ''}${v}d`}
                  />
                  <Bar dataKey="count">
                    {member.hearing_proximity.map((p, i) => (
                      <Cell key={i} fill={p.signed > 0.1 ? 'var(--positive)' : p.signed < -0.1 ? 'var(--negative)' : 'var(--text-tertiary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="num mt-2 text-[10px] text-[var(--text-tertiary)]">
              Lateness score: <span className={member.scores.lateness_score > 0.3 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>{(member.scores.lateness_score * 100).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Right col */}
        <div className="col-span-7 space-y-3">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Holdings (cumulative buy − sell)
            </div>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-1.5 text-left">Ticker</th>
                  <th className="px-3 py-1.5 text-left">Company</th>
                  <th className="px-3 py-1.5 text-right">Net est.</th>
                  <th className="px-3 py-1.5 text-right">Trades</th>
                  <th className="px-3 py-1.5 text-right">Last</th>
                </tr>
              </thead>
              <tbody>
                {holdingsArr.slice(0, 12).map(h => (
                  <tr key={h.ticker} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                    <td className="px-3 py-1.5"><Link to="/tickers/$symbol" params={{ symbol: h.ticker }} className="num text-[var(--cyan)] hover:underline">{h.ticker}</Link></td>
                    <td className="px-3 py-1.5 text-[var(--text-secondary)] truncate">{h.company}</td>
                    <td className={'num px-3 py-1.5 text-right ' + signClass(h.net)}>{h.net >= 0 ? '+' : ''}${(Math.abs(h.net)/1000).toFixed(0)}K</td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">{h.count}</td>
                    <td className="px-3 py-1.5 text-right"><RelTime iso={h.lastDate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Recent trades
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--bg-1)] text-[10px] uppercase text-[var(--text-tertiary)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-1.5 text-left">Ticker</th>
                    <th className="px-3 py-1.5 text-left">Type</th>
                    <th className="px-3 py-1.5 text-right">Amount</th>
                    <th className="px-3 py-1.5 text-left">Owner</th>
                    <th className="px-3 py-1.5 text-left">Flags</th>
                    <th className="px-3 py-1.5 text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {txns?.items.map(t => (
                    <tr key={t.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]">
                      <td className="px-3 py-1.5"><Link to="/tickers/$symbol" params={{ symbol: t.ticker }} className="num text-[var(--cyan)] hover:underline">{t.ticker}</Link></td>
                      <td className={'px-3 py-1.5 num text-[10px] uppercase ' + (t.type === 'buy' ? 'text-[var(--positive)]' : t.type === 'sell' ? 'text-[var(--negative)]' : 'text-[var(--text-secondary)]')}>{t.type}</td>
                      <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmtUSDRange(t.amount_min, t.amount_max)}</td>
                      <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">{t.owner_type}</td>
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
    </div>
  );
}

function Score({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
      <div className={'num mt-0.5 text-2xl ' + (cls ?? 'text-[var(--text-primary)]')}>{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Activity, TrendingUp, Users } from 'lucide-react';
import {
  getCommitteeFlowTop,
  getDashboardSummary,
  getPredictiveFeed,
  getReactiveFeed,
  listClusters,
  listTransactions,
} from '@/api/client';
import { Sparkline } from '@/components/Sparkline';
import { RelTime } from '@/components/RelTime';
import { FlagRow } from '@/components/FlagBadge';
import { fmtUSD, fmtUSDRange, fmtPctRaw, signClass } from '@/lib/format';
import { SkeletonRows } from '@/components/SkeletonRows';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Dashboard — CongressTrade Intelligence' },
      { name: 'description', content: 'Live overview of congressional trade signals, clusters, and committee flow.' },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <span className={accent ?? 'text-[var(--text-secondary)]'}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="num text-3xl font-medium tracking-tight text-[var(--text-primary)]">{value}</div>
        {sub}
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: summary, isLoading: l1 } = useQuery({ queryKey: ['summary'], queryFn: getDashboardSummary });
  const { data: flow, isLoading: l2 } = useQuery({ queryKey: ['flow-top'], queryFn: () => getCommitteeFlowTop(3) });
  const { data: clusters, isLoading: l3 } = useQuery({ queryKey: ['clusters', 'top3'], queryFn: () => listClusters({ limit: 3 }) });
  const { data: predictive } = useQuery({ queryKey: ['feed', 'predictive'], queryFn: getPredictiveFeed });
  const { data: reactive } = useQuery({ queryKey: ['feed', 'reactive'], queryFn: getReactiveFeed });
  const { data: flagged } = useQuery({ queryKey: ['tx', 'flagged-recent'], queryFn: () => listTransactions({ has_any_flag: true, limit: 12 }) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Dashboard</h1>
        <p className="num mt-0.5 text-[10px] text-[var(--text-tertiary)]" suppressHydrationWarning>Last update: {new Date().toISOString().slice(0,16).replace('T',' ')}Z</p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          accent="text-[var(--cyan)]"
          icon={<Activity className="h-3 w-3" />}
          label="Active flagged trades"
          value={l1 ? '—' : (summary?.active_flagged_count ?? 0)}
          sub={summary && <Sparkline data={summary.active_flagged_series} width={120} height={28} />}
        />
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <TrendingUp className="h-3 w-3 text-[var(--purple)]" /> Top committee flow
          </div>
          <div className="mt-2 space-y-1.5">
            {l2 ? <SkeletonRows rows={3} cols={3} /> : flow?.map(f => (
              <div key={f.sector} className="flex items-center gap-3">
                <div className="flex-1 truncate text-xs text-[var(--text-primary)]">{f.sector}</div>
                <Sparkline data={f.series} width={60} height={16} />
                <div className={'num min-w-[64px] text-right text-xs ' + signClass(f.net_usd)}>{f.net_usd >= 0 ? '+' : ''}{fmtUSD(f.net_usd, { compact: true })}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-[var(--cluster-active)]" /> Active clusters</span>
            <Link to="/clusters" className="text-[var(--cyan)] hover:underline">view all →</Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {l3 ? <SkeletonRows rows={3} cols={3} /> : clusters?.map(c => (
              <Link to="/tickers/$symbol" params={{ symbol: c.ticker }} key={c.id} className="block rounded px-1 py-0.5 hover:bg-[var(--bg-2)]">
                <div className="flex items-center gap-2">
                  <span className="num text-xs text-[var(--text-primary)]">{c.ticker}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] truncate">{c.committee_name}</span>
                  <span className={'num ml-auto text-[10px] uppercase ' + (c.direction === 'buy' ? 'text-[var(--positive)]' : 'text-[var(--negative)]')}>
                    {c.member_count} {c.direction}
                  </span>
                </div>
              </Link>
            ))}
            <div className="num pt-1 text-[10px] text-[var(--text-tertiary)]">{summary?.active_clusters_count ?? 0} total active</div>
          </div>
        </div>
      </div>

      {/* Two-column feeds */}
      <div className="grid grid-cols-2 gap-3">
        <FeedColumn
          title="Predictive feed"
          accent="text-[var(--predictive)]"
          items={predictive?.slice(0, 24)}
        />
        <FeedColumn
          title="Reactive feed"
          accent="text-[var(--reactive)]"
          items={reactive?.slice(0, 24)}
        />
      </div>

      {/* Recent flagged trades */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          Recent flagged trades
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-1.5 text-left">Member</th>
              <th className="px-3 py-1.5 text-left">Ticker</th>
              <th className="px-3 py-1.5 text-left">Type</th>
              <th className="px-3 py-1.5 text-right">Amount</th>
              <th className="px-3 py-1.5 text-left">Owner</th>
              <th className="px-3 py-1.5 text-left">Flags</th>
              <th className="px-3 py-1.5 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {flagged?.items.map(t => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.08 }}
                className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-2)]"
              >
                <td className="px-3 py-1.5">
                  <Link to="/members/$id" params={{ id: t.member_id }} className="text-[var(--text-primary)] hover:underline">
                    {t.member_name}
                  </Link>
                </td>
                <td className="px-3 py-1.5">
                  <Link to="/tickers/$symbol" params={{ symbol: t.ticker }} className="num text-[var(--cyan)] hover:underline">
                    {t.ticker}
                  </Link>
                </td>
                <td className="px-3 py-1.5">
                  <span className={'num text-[10px] uppercase ' + (t.type === 'buy' ? 'text-[var(--positive)]' : t.type === 'sell' ? 'text-[var(--negative)]' : 'text-[var(--text-secondary)]')}>{t.type}</span>
                </td>
                <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmtUSDRange(t.amount_min, t.amount_max)}</td>
                <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">{t.owner_type}</td>
                <td className="px-3 py-1.5"><FlagRow flags={t.flags} /></td>
                <td className="px-3 py-1.5 text-right"><RelTime iso={t.transaction_date} /></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedColumn({ title, accent, items }: { title: string; accent: string; items?: any[] }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        <span className={accent}>{title}</span>
        <span className="num text-[var(--text-tertiary)]">{items?.length ?? 0}</span>
      </div>
      <div className="max-h-[480px] overflow-auto">
        {!items && <div className="p-3"><SkeletonRows rows={6} cols={4} /></div>}
        {items?.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.08, delay: Math.min(i * 0.005, 0.1) }}
            className="flex items-center gap-2 border-b border-[var(--border)]/40 px-3 py-1.5 hover:bg-[var(--bg-2)]"
          >
            <span className={'rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ring-1 ' + (s.kind === 'predictive' ? 'bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30' : 'bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30')}>
              {s.signal_type}
            </span>
            <Link to="/members/$id" params={{ id: s.member_id }} className="truncate text-xs text-[var(--text-primary)] hover:underline">
              {s.member_name}
            </Link>
            <Link to="/tickers/$symbol" params={{ symbol: s.ticker }} className="num text-xs text-[var(--cyan)] hover:underline">
              {s.ticker}
            </Link>
            <span className="num ml-auto text-xs text-[var(--text-secondary)]">{fmtPctRaw(s.score * 100, 0).replace('+','')}</span>
            <RelTime iso={s.created_at} className="ml-2 min-w-[44px] text-right" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

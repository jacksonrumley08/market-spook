import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { listAlerts } from '@/api/client';
import { RelTime } from '@/components/RelTime';
import { SkeletonRows } from '@/components/SkeletonRows';
import { cn } from '@/lib/utils';
import type { AlertOut } from '@/api/types';

export const Route = createFileRoute('/alerts')({
  head: () => ({
    meta: [
      { title: 'Alerts — CongressTrade Intelligence' },
      { name: 'description', content: 'Filterable event stream of cluster, contract, blackout, and watchlist alerts.' },
    ],
  }),
  component: AlertsPage,
});

const ALL_KINDS: AlertOut['kind'][] = ['CLUSTER_THRESHOLD', 'CONTRACT_PROXIMITY', 'FOMC_BLACKOUT', 'WATCHLIST_MATCH', 'NEWS_CATALYST', 'INGESTION_HEALTH'];

const KIND_COLOR: Record<AlertOut['kind'], string> = {
  CLUSTER_THRESHOLD: 'bg-[var(--cluster-active)]/15 text-[var(--cluster-active)] ring-[var(--cluster-active)]/30',
  CONTRACT_PROXIMITY: 'bg-[var(--blue)]/15 text-[var(--blue)] ring-[var(--blue)]/30',
  FOMC_BLACKOUT: 'bg-[var(--red)]/15 text-[var(--red)] ring-[var(--red)]/30',
  WATCHLIST_MATCH: 'bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30',
  NEWS_CATALYST: 'bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30',
  INGESTION_HEALTH: 'bg-[var(--text-tertiary)]/15 text-[var(--text-secondary)] ring-[var(--border)]',
};

function AlertsPage() {
  const [activeKinds, setActiveKinds] = useState<Set<AlertOut['kind']>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', showDismissed],
    queryFn: () => listAlerts(showDismissed ? {} : { dismissed: false }),
  });

  const filtered = (data ?? []).filter(a => activeKinds.size === 0 || activeKinds.has(a.kind));

  const toggleKind = (k: AlertOut['kind']) => {
    const next = new Set(activeKinds);
    if (next.has(k)) next.delete(k); else next.add(k);
    setActiveKinds(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Alerts</h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">{filtered.length} shown</p>
        </div>
        <label className="flex items-center gap-2 text-[10px] uppercase text-[var(--text-secondary)]">
          <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} className="accent-[var(--cyan)]" />
          show dismissed
        </label>
      </div>

      <div className="flex flex-wrap gap-1">
        {ALL_KINDS.map(k => (
          <button
            key={k}
            onClick={() => toggleKind(k)}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1 transition-colors',
              activeKinds.has(k) ? KIND_COLOR[k] : 'bg-[var(--bg-1)] text-[var(--text-tertiary)] ring-[var(--border)] hover:text-[var(--text-secondary)]',
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        {isLoading && <div className="p-3"><SkeletonRows rows={8} cols={5} /></div>}
        {filtered.map(a => (
          <div key={a.id} className="border-b border-[var(--border)]/40">
            <button
              onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-[var(--bg-2)]"
            >
              <span className={'h-2 w-2 rounded-full ' + (a.severity === 'critical' ? 'bg-[var(--negative)]' : 'bg-[var(--warning)]')} />
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1', KIND_COLOR[a.kind])}>{a.kind}</span>
              <span className="flex-1 truncate text-[var(--text-primary)]">{a.summary}</span>
              {a.member_id && <Link onClick={e => e.stopPropagation()} to="/members/$id" params={{ id: a.member_id }} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--cyan)]">member →</Link>}
              {a.ticker && <Link onClick={e => e.stopPropagation()} to="/tickers/$symbol" params={{ symbol: a.ticker }} className="num text-[10px] text-[var(--cyan)] hover:underline">{a.ticker}</Link>}
              <RelTime iso={a.created_at} />
              {a.dismissed && <span className="num text-[9px] uppercase text-[var(--text-tertiary)]">dismissed</span>}
            </button>
            <AnimatePresence>
              {expandedId === a.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-[var(--border)]/40 bg-[var(--bg-0)]"
                >
                  <pre className="num overflow-auto p-3 text-[11px] text-[var(--text-secondary)]">
{JSON.stringify(a.payload, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

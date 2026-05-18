import { useEffect, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Bell, Calendar, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listAlerts, listMembers, listTickerSymbols } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGlobalFilter, RANGE_LABEL, type DateRangePreset } from '@/lib/filter-store';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/members', label: 'Members' },
  { to: '/committees', label: 'Committees' },
  { to: '/clusters', label: 'Clusters' },
  { to: '/leaderboards', label: 'Leaderboards' },
  { to: '/backtest', label: 'Backtest' },
  { to: '/alerts', label: 'Alerts' },
] as const;

function NavLinks() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <nav className="flex items-center gap-1">
      {NAV.map(item => {
        const active = item.to === '/' ? path === '/' : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded px-2.5 py-1 text-xs uppercase tracking-wider transition-colors',
              active
                ? 'bg-[var(--bg-2)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FilterChip() {
  const f = useGlobalFilter();
  const ranges: DateRangePreset[] = ['7d', '30d', '90d', '180d', '365d'];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-[var(--border)] bg-[var(--bg-1)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]"
        >
          <Calendar className="h-3 w-3" />
          <span className="num">{RANGE_LABEL[f.range]}</span>
          {(f.chamber !== 'all' || f.owner !== 'all') && (
            <span className="ml-1 rounded bg-[var(--cyan)]/20 px-1 text-[10px] text-[var(--cyan)]">
              {[f.chamber !== 'all' && 'chmbr', f.owner !== 'all' && 'ownr'].filter(Boolean).join(' ')}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-[var(--bg-2)] border-[var(--border)] p-3 space-y-3">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Range</div>
          <div className="flex flex-wrap gap-1">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => f.set({ range: r })}
                className={cn(
                  'num rounded px-2 py-1 text-xs ring-1',
                  f.range === r
                    ? 'bg-[var(--cyan)]/20 text-[var(--cyan)] ring-[var(--cyan)]/30'
                    : 'bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)] hover:text-[var(--text-primary)]',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Chamber</div>
          <div className="flex gap-1">
            {(['all', 'house', 'senate'] as const).map(c => (
              <button
                key={c}
                onClick={() => f.set({ chamber: c })}
                className={cn(
                  'rounded px-2 py-1 text-xs uppercase ring-1',
                  f.chamber === c
                    ? 'bg-[var(--cyan)]/20 text-[var(--cyan)] ring-[var(--cyan)]/30'
                    : 'bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)] hover:text-[var(--text-primary)]',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Owner</div>
          <div className="flex flex-wrap gap-1">
            {(['all', 'self', 'spouse', 'dependent', 'joint'] as const).map(o => (
              <button
                key={o}
                onClick={() => f.set({ owner: o })}
                className={cn(
                  'rounded px-2 py-1 text-xs uppercase ring-1',
                  f.owner === o
                    ? 'bg-[var(--cyan)]/20 text-[var(--cyan)] ring-[var(--cyan)]/30'
                    : 'bg-[var(--bg-1)] text-[var(--text-secondary)] ring-[var(--border)] hover:text-[var(--text-primary)]',
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CmdK() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: members } = useQuery({ queryKey: ['members-cmdk'], queryFn: () => listMembers({ limit: 999 }) });
  const { data: tickers } = useQuery({ queryKey: ['tickers-cmdk'], queryFn: () => listTickerSymbols() });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex h-7 w-72 items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-1)] px-2 text-xs text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)]"
      >
        <Search className="h-3 w-3" />
        <span>Jump to member or ticker…</span>
        <span className="num ml-auto rounded bg-[var(--bg-2)] px-1 text-[10px]">⌘K</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search members, tickers…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Members">
            {members?.items.slice(0, 30).map(m => (
              <CommandItem
                key={m.id}
                value={`${m.name} ${m.state} ${m.chamber}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: '/members/$id', params: { id: m.id } });
                }}
              >
                <span>{m.name}</span>
                <span className="ml-auto text-[10px] text-[var(--text-secondary)] num">{m.party}·{m.state}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tickers">
            {tickers?.map(t => (
              <CommandItem
                key={t.symbol}
                value={`${t.symbol} ${t.company_name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: '/tickers/$symbol', params: { symbol: t.symbol } });
                }}
              >
                <span className="num">{t.symbol}</span>
                <span className="ml-2 text-[var(--text-secondary)]">{t.company_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function AlertBell() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['alerts-unread'],
    queryFn: () => listAlerts({ status: 'OPEN', limit: 100 }),
  });
  const count = data?.items.length ?? 0;
  return (
    <button
      onClick={() => navigate({ to: '/alerts', search: { status: 'OPEN', page: 1 } })}
      className="relative flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]"
    >
      <Bell className="h-3.5 w-3.5" />
      {count > 0 && (
        <span className="num absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[9px] font-medium text-black">
          {count}
        </span>
      )}
    </button>
  );
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-0)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-0)]/80">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-[var(--cyan)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">CongressTrade</span>
          <span className="num text-[10px] text-[var(--text-tertiary)]">v0.1</span>
        </Link>
        <div className="ml-2"><NavLinks /></div>
        <div className="ml-auto flex items-center gap-2">
          <CmdK />
          <FilterChip />
          <AlertBell />
        </div>
      </div>
    </header>
  );
}

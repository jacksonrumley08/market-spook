import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, Bell, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getIngestionHealth, listAlerts, listMembers, listTickerSymbols } from "@/api/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", hint: "Dashboard" },
  { to: "/members", label: "Members", hint: "Members of Congress directory" },
  { to: "/committees", label: "Committees", hint: "Congressional committees" },
  {
    to: "/districts",
    label: "Districts",
    hint: "Congressional districts ranked by alert activity",
  },
  { to: "/scotus", label: "SCOTUS", hint: "Supreme Court justices" },
  { to: "/clusters", label: "Clusters", hint: "Coordinated trading detected across members" },
  { to: "/leaderboards", label: "Rankings", hint: "Members ranked by overall score" },
  { to: "/backtest", label: "Backtest", hint: "Strategy backtests against real alerts" },
  { to: "/alerts", label: "Alerts", hint: "All detector alerts" },
  { to: "/news", label: "News", hint: "News articles linked to member trades" },
] as const;

function NavLinks() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Horizontal-scroll on small viewports so all nav entries remain reachable;
  // at md+ the row fits without scrolling.
  return (
    <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
      {NAV.map((item) => {
        const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            title={item.hint}
            className={cn(
              "rounded px-2.5 py-1 text-xs uppercase tracking-wider transition-colors",
              active
                ? "bg-[var(--bg-2)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CmdK() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Gate to `enabled: open` so the 500+-row member fetch + ticker fetch don't
  // hit the API on every page load — they were running on the homepage even
  // for users who never press Cmd+K.
  const { data: members } = useQuery({
    queryKey: ["members-cmdk"],
    queryFn: () => listMembers({ limit: 999 }),
    enabled: open,
  });
  const { data: tickers } = useQuery({
    queryKey: ["tickers-cmdk"],
    queryFn: () => listTickerSymbols(),
    enabled: open,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          <CommandEmpty>No matches. Try a full name or ticker symbol.</CommandEmpty>
          <CommandGroup heading="Members">
            {members?.items.slice(0, 30).map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.name} ${m.state} ${m.chamber}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/members/$id", params: { id: m.id } });
                }}
              >
                <span>{m.name}</span>
                <span className="ml-auto text-[10px] text-[var(--text-secondary)] num">
                  {m.party}·{m.state}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tickers">
            {tickers?.map((t) => (
              <CommandItem
                key={t.symbol}
                value={`${t.symbol} ${t.company_name}`}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: "/tickers/$symbol", params: { symbol: t.symbol } });
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

// Bell shows count of critical-severity OPEN alerts. The full alert table can
// have 100k+ rows, so an unscoped count would always cap at 100 and read as
// permanently meaningless. We probe critical-only (a much narrower cohort)
// and cap visually at 99+ so the digit stays single-character wide.
function AlertBell() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["alerts-unread", "critical"],
    queryFn: () => listAlerts({ status: "OPEN", limit: 100 }),
  });
  const criticalItems = (data?.items ?? []).filter((a) => a.severity === "critical");
  const count = criticalItems.length;
  const more = data?.has_more ?? false;
  const display = count >= 99 || (count === 100 && more) ? "99+" : String(count);
  const title = isLoading
    ? "Loading alert count…"
    : count === 0
      ? "No critical alerts open"
      : `${display} critical alert${count === 1 ? "" : "s"} open`;
  return (
    <button
      onClick={() => navigate({ to: "/alerts", search: { status: "OPEN", page: 1 } })}
      title={title}
      className="relative flex h-7 w-7 items-center justify-center rounded text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]"
    >
      <Bell className="h-3.5 w-3.5" />
      {isLoading && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]/40" />
      )}
      {!isLoading && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--negative)] px-1 text-[9px] font-medium text-white">
          {display}
        </span>
      )}
    </button>
  );
}

// Operator-facing health indicator. Drives off `display_status` (the
// derived field), not the raw FSM `health_status` — that way a source
// emitting INGESTION_HEALTH alerts while the FSM says HEALTHY (yfinance
// high_loss_rate) or a source whose cron silently stopped (STALE) still
// triggers the dot. DEFERRED is excluded — that's a known-not-running
// state, not an incident.
function HealthDot() {
  const { data } = useQuery({
    queryKey: ["admin-health"],
    queryFn: getIngestionHealth,
    refetchInterval: 60_000,
  });
  const sources = data?.sources ?? [];
  const disabled = sources.filter((s) => s.display_status === "DISABLED").length;
  const degraded = sources.filter((s) => s.display_status === "DEGRADED").length;
  const stale = sources.filter((s) => s.display_status === "STALE").length;
  const tone =
    disabled > 0
      ? "text-[var(--negative)]"
      : degraded > 0 || stale > 0
        ? "text-[var(--warning)]"
        : "text-[var(--text-secondary)]";
  const dotColor =
    disabled > 0
      ? "bg-[var(--negative)]"
      : degraded > 0 || stale > 0
        ? "bg-[var(--warning)]"
        : null;
  const titleParts = [`Ingestion health · ${sources.length} sources`];
  if (disabled > 0) titleParts.push(`${disabled} disabled`);
  if (degraded > 0) titleParts.push(`${degraded} degraded`);
  if (stale > 0) titleParts.push(`${stale} stale`);
  return (
    <Link
      to="/admin/health"
      title={titleParts.join(" · ")}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]",
        tone,
      )}
    >
      <Activity className="h-3.5 w-3.5" />
      {dotColor && (
        <span className={cn("absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full", dotColor)} />
      )}
    </Link>
  );
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-0)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-0)]/80">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-[var(--cyan)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">CongressTrade</span>
        </Link>
        <div className="ml-2">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CmdK />
          <HealthDot />
          <AlertBell />
        </div>
      </div>
    </header>
  );
}

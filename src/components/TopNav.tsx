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
  { to: "/", label: "Home" },
  { to: "/members", label: "Members" },
  { to: "/committees", label: "Committees" },
  { to: "/clusters", label: "Clusters" },
  { to: "/leaderboards", label: "Leaderboards" },
  { to: "/backtest", label: "Backtest" },
  { to: "/alerts", label: "Alerts" },
  { to: "/news", label: "News" },
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
  const { data: members } = useQuery({
    queryKey: ["members-cmdk"],
    queryFn: () => listMembers({ limit: 999 }),
  });
  const { data: tickers } = useQuery({
    queryKey: ["tickers-cmdk"],
    queryFn: () => listTickerSymbols(),
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
          <CommandEmpty>No results.</CommandEmpty>
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

function AlertBell() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["alerts-unread"],
    queryFn: () => listAlerts({ status: "OPEN", limit: 100 }),
  });
  const count = data?.items.length ?? 0;
  return (
    <button
      onClick={() => navigate({ to: "/alerts", search: { status: "OPEN", page: 1 } })}
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

// Small ops indicator. Pings /admin/ingestion/health every 60s in the
// background (cached by react-query so /admin/health reuses the same query).
// Renders an amber dot when any source is DEGRADED so operators can see
// trouble without opening the page.
function HealthDot() {
  const { data } = useQuery({
    queryKey: ["admin-health"],
    queryFn: getIngestionHealth,
    refetchInterval: 60_000,
  });
  const sources = data?.sources ?? [];
  const degraded = sources.filter((s) => s.health_status === "DEGRADED").length;
  const tone = degraded > 0 ? "text-[var(--warning)]" : "text-[var(--text-secondary)]";
  return (
    <Link
      to="/admin/health"
      title={`Ingestion health · ${sources.length} sources${degraded ? ` · ${degraded} degraded` : ""}`}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]",
        tone,
      )}
    >
      <Activity className="h-3.5 w-3.5" />
      {degraded > 0 && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
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
          <span className="num text-[10px] text-[var(--text-tertiary)]">v0.1</span>
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

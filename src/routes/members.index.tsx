import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getLeaderboard, listMembers } from "@/api/client";
import { PartyChip } from "@/components/PartyChip";
import { SkeletonRows } from "@/components/SkeletonRows";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtPctRaw, signClass } from "@/lib/format";
import type { LeaderboardEntry } from "@/api/types-ui";

// Backend caps /members?limit at 200; offset is supported.
const PAGE_LIMIT = 50;

type SortKey =
  | "name"
  | "state"
  | "party"
  | "alpha_90d"
  | "n_trades_lifetime"
  | "alert_count_lifetime"
  | "composite_score";

type Search = {
  page: number;
  q: string;
  sort: SortKey;
  asc: boolean;
};

export const Route = createFileRoute("/members/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const pageRaw = Number(s.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const q = typeof s.q === "string" ? s.q : "";
    const sortRaw = typeof s.sort === "string" ? s.sort : "alpha_90d";
    const validSorts: SortKey[] = [
      "name",
      "state",
      "party",
      "alpha_90d",
      "n_trades_lifetime",
      "alert_count_lifetime",
      "composite_score",
    ];
    const sort: SortKey = (validSorts as string[]).includes(sortRaw)
      ? (sortRaw as SortKey)
      : "alpha_90d";
    const asc = s.asc === true || s.asc === "true";
    return { page, q, sort, asc };
  },
  head: () => ({
    meta: [
      { title: "Members — CongressTrade Intelligence" },
      {
        name: "description",
        content: "All tracked US House and Senate members with composite scores and α columns.",
      },
    ],
  }),
  component: MembersIndex,
});

function MembersIndex() {
  const { page, q, sort, asc } = Route.useSearch();
  const navigate = useNavigate({ from: "/members/" });
  const [searchInput, setSearchInput] = useState(q);

  const offset = (page - 1) * PAGE_LIMIT;

  // Members page (backend offset-paginated).
  const membersQ = useQuery({
    queryKey: ["members", q, page],
    queryFn: () => listMembers({ search: q, limit: PAGE_LIMIT, offset }),
    placeholderData: (prev) => prev,
  });

  // Leaderboard for α / n_trades / alert_count joining. Cached at 5min;
  // shared with the /leaderboards page.
  const leaderboardQ = useQuery({
    queryKey: ["leaderboard", "composite"],
    queryFn: () => getLeaderboard("composite"),
    staleTime: 5 * 60_000,
  });

  const lbByMember = useMemo(() => {
    const m = new Map<string, LeaderboardEntry>();
    for (const e of leaderboardQ.data ?? []) m.set(e.member_id, e);
    return m;
  }, [leaderboardQ.data]);

  const setSearch = (next: Partial<Search>) => {
    navigate({ search: (prev) => ({ ...prev, ...next }) });
  };

  const onSort = (k: SortKey) => {
    if (sort === k) setSearch({ asc: !asc });
    else setSearch({ sort: k, asc: false });
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch({ q: searchInput, page: 1 });
  };

  // Sort within the current page only — backend doesn't sort by lifetime
  // alpha/composite, and pagination is over the server-side member list, not
  // over alpha-ranked members. Document explicitly so the small-page UX is
  // clear: sort reorders the visible page.
  const sortedItems = useMemo(() => {
    const items = membersQ.data?.items ?? [];
    const enriched = items.map((m) => ({
      m,
      lb: lbByMember.get(m.id) ?? null,
    }));
    enriched.sort((a, b) => {
      const av = sortValue(a.m, a.lb, sort);
      const bv = sortValue(b.m, b.lb, sort);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return enriched;
  }, [membersQ.data, lbByMember, sort, asc]);

  const total = membersQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const hasNext = page < pageCount;
  const isLoading = membersQ.isLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Members
          </h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            {total.toLocaleString()} tracked · page {page} of {pageCount} · showing{" "}
            {sortedItems.length}
          </p>
        </div>
        <form onSubmit={onSearchSubmit} className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or bioguide id…"
            className="h-8 w-72 border-[var(--border)] bg-[var(--bg-1)] text-xs"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch({ q: "", page: 1 });
              }}
              className="rounded px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)]"
            >
              clear
            </button>
          )}
        </form>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <table className="w-full text-xs">
          <thead className="sticky top-12 z-10 bg-[var(--bg-1)]">
            <tr className="border-b border-[var(--border)]">
              <Th sort={sort} asc={asc} k="name" onClick={onSort}>
                Member
              </Th>
              <Th sort={sort} asc={asc} k="party" onClick={onSort}>
                Party
              </Th>
              <Th sort={sort} asc={asc} k="state" onClick={onSort}>
                State
              </Th>
              <Th sort={sort} asc={asc} k="alpha_90d" onClick={onSort} align="right">
                α 90d
              </Th>
              <Th sort={sort} asc={asc} k="composite_score" onClick={onSort} align="right">
                Composite
              </Th>
              <Th sort={sort} asc={asc} k="n_trades_lifetime" onClick={onSort} align="right">
                n_trades
              </Th>
              <Th sort={sort} asc={asc} k="alert_count_lifetime" onClick={onSort} align="right">
                Alerts
              </Th>
              <th className="px-3 py-1.5 text-left text-[10px] uppercase text-[var(--text-tertiary)]">
                Committees
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-3">
                  <SkeletonRows rows={10} cols={8} />
                </td>
              </tr>
            )}
            {!isLoading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
                  No members match this search.
                </td>
              </tr>
            )}
            {sortedItems.map(({ m, lb }) => {
              const alpha90: number | null = lb?.alpha_90d ?? null;
              const composite = lb?.composite_score ?? null;
              const nTrades = lb?.n_trades_lifetime ?? 0;
              const alertCount = lb?.alert_count_lifetime ?? 0;
              const insufficient = lb != null && !lb.has_sufficient_sample;
              return (
                <tr
                  key={m.id}
                  className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-1.5">
                    <Link
                      to="/members/$id"
                      params={{ id: m.id }}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {m.name}
                    </Link>
                    {insufficient && (
                      <span
                        className="ml-1.5 text-[9px] text-[var(--text-tertiary)]"
                        title="Insufficient sample (n_trades_lifetime < 10) — scores may be unreliable."
                      >
                        small-n
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <PartyChip party={m.party} state={m.state} chamber={m.chamber} />
                  </td>
                  <td className="num px-3 py-1.5 text-[var(--text-secondary)]">
                    {m.state}
                    {m.district != null && `-${m.district}`}
                  </td>
                  <td
                    className={cn(
                      "num px-3 py-1.5 text-right",
                      alpha90 == null ? "text-[var(--text-tertiary)]" : signClass(alpha90),
                    )}
                  >
                    {alpha90 == null ? "—" : fmtPctRaw(alpha90 * 100, 2)}
                  </td>
                  <td
                    className={cn(
                      "num px-3 py-1.5 text-right",
                      composite == null
                        ? "text-[var(--text-tertiary)]"
                        : "text-[var(--text-primary)]",
                    )}
                  >
                    {composite == null ? "—" : composite.toFixed(3)}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                    {nTrades.toLocaleString()}
                  </td>
                  <td
                    className={cn(
                      "num px-3 py-1.5 text-right",
                      alertCount > 0
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-tertiary)]",
                    )}
                  >
                    {alertCount.toLocaleString()}
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">
                    {m.committees.length === 0 ? "—" : m.committees.map((c) => c.name).join(" · ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <button
            onClick={() => setSearch({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← prev
          </button>
          <span className="num">
            page {page} / {pageCount}
          </span>
          <button
            onClick={() => setSearch({ page: page + 1 })}
            disabled={!hasNext}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

function sortValue(
  m: { name: string; state: string; party: string },
  lb: LeaderboardEntry | null,
  k: SortKey,
): string | number | null {
  switch (k) {
    case "name":
      return m.name.toLowerCase();
    case "state":
      return m.state;
    case "party":
      return m.party;
    case "alpha_90d":
      return lb?.alpha_90d ?? null;
    case "composite_score":
      return lb?.composite_score ?? null;
    case "n_trades_lifetime":
      return lb?.n_trades_lifetime ?? 0;
    case "alert_count_lifetime":
      return lb?.alert_count_lifetime ?? 0;
    default:
      return null;
  }
}

function Th({
  sort,
  asc,
  k,
  onClick,
  children,
  align,
}: {
  sort: SortKey;
  asc: boolean;
  k: SortKey;
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
  align?: "right";
}) {
  const active = sort === k;
  return (
    <th
      onClick={() => onClick(k)}
      className={cn(
        "cursor-pointer select-none px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
      {active && <span className="ml-1 text-[var(--cyan)]">{asc ? "↑" : "↓"}</span>}
    </th>
  );
}

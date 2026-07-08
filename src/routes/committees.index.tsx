import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCommittees } from "@/api/client";
import { SkeletonRows } from "@/components/SkeletonRows";

export const Route = createFileRoute("/committees/")({
  head: () => ({
    meta: [
      { title: "Committees — CongressTrade Intelligence" },
      {
        name: "description",
        content: "Congressional committees with jurisdictional sectors and member counts.",
      },
    ],
  }),
  component: CommitteesIndex,
});

function CommitteesIndex() {
  const { data, isLoading } = useQuery({ queryKey: ["committees"], queryFn: listCommittees });
  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 text-[11px] text-[var(--warning)]">
        <strong className="font-medium uppercase tracking-wider">Demo data</strong> — the
        committee-list backend endpoint is not implemented yet. The {data?.length ?? 8} tiles below
        are a sample (House committees only). Click any tile to load the real roster and hearings
        for that committee from the live API.
      </div>
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Committees
        </h1>
        <p className="num text-[10px] text-[var(--text-tertiary)]">
          {data?.length ?? 0} shown · click a tile for live roster
        </p>
      </div>
      {isLoading && <SkeletonRows rows={6} cols={4} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data?.map((c) => (
          <Link
            key={c.id}
            to="/committees/$id"
            params={{ id: c.id }}
            className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-2)]/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-[var(--text-primary)]">{c.name}</div>
                <div className="mt-0.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                  {c.chamber}
                </div>
              </div>
            </div>
            {c.jurisdiction_summary && (
              <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">
                {c.jurisdiction_summary}
              </p>
            )}
            {c.jurisdiction_sectors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.jurisdiction_sectors.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

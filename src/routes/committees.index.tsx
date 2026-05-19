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
  const rows = data ?? [];
  const senateWithoutRoster = rows.filter(
    (c) => c.chamber === "senate" && (c.member_count ?? 0) === 0,
  );
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Committees
        </h1>
        <p className="num text-[10px] text-[var(--text-tertiary)]">
          {rows.length} shown · House Clerk feed · click any tile for roster + hearings
        </p>
      </div>
      {senateWithoutRoster.length > 0 && (
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          <strong className="font-medium uppercase tracking-wider text-[var(--text-primary)]">
            Senate rosters unavailable
          </strong>{" "}
          — {senateWithoutRoster.length} Senate committees ship without a member list because the
          House Clerk MemberData feed has no Senate parallel. Senate EFD ingestion is deferred per
          the v1 plan; track via /admin/health.
        </div>
      )}
      {isLoading && <SkeletonRows rows={6} cols={4} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((c) => (
          <Link
            key={c.id}
            to="/committees/$id"
            params={{ id: c.id }}
            className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-2)]/50"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm text-[var(--text-primary)]">{c.name}</div>
                <div className="mt-0.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                  {c.chamber.toUpperCase()}
                  {" · "}
                  {(c.member_count ?? 0) > 0 ? `${c.member_count} members` : "roster pending"}
                </div>
              </div>
              {c.chair_name && (
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    Chair
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{c.chair_name}</div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

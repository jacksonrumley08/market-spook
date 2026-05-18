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
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Committees
        </h1>
        <p className="num text-[10px] text-[var(--text-tertiary)]">{data?.length ?? 0} tracked</p>
      </div>
      {isLoading && <SkeletonRows rows={6} cols={4} />}
      <div className="grid grid-cols-2 gap-3">
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
                <div className="num mt-0.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                  {c.chamber} · {c.member_count} members
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-secondary)] line-clamp-2">
              {c.jurisdiction_summary}
            </p>
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
          </Link>
        ))}
      </div>
    </div>
  );
}

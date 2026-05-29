import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listClusters } from "@/api/client";
import { Sparkline } from "@/components/Sparkline";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";

export const Route = createFileRoute("/clusters")({
  head: () => ({
    meta: [
      { title: "Cluster watch — CongressTrade Intelligence" },
      {
        name: "description",
        content: "Active multi-member committee clusters with predictive context.",
      },
    ],
  }),
  component: ClustersPage,
});

function ClustersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["clusters"], queryFn: () => listClusters({}) });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Cluster watch
        </h1>
        <p className="num text-[10px] text-[var(--text-tertiary)]">{data?.length ?? 0} active</p>
      </div>
      {isLoading && <SkeletonRows rows={6} cols={4} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((c) => (
          <div
            key={c.id}
            className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4 space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <Link
                    to="/tickers/$symbol"
                    params={{ symbol: c.ticker }}
                    className="num text-base text-[var(--cyan)] hover:underline"
                  >
                    {c.ticker}
                  </Link>
                  {c.company_name && c.company_name !== c.ticker && (
                    <span className="text-[10px] text-[var(--text-tertiary)] truncate">
                      {c.company_name}
                    </span>
                  )}
                </div>
                <Link
                  to="/committees/$id"
                  params={{ id: c.committee_id }}
                  className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {c.committee_name}
                </Link>
              </div>
              <span
                className={
                  "num rounded px-1.5 py-0.5 text-[10px] uppercase ring-1 " +
                  (c.direction === "buy"
                    ? "bg-[var(--positive)]/15 text-[var(--positive)] ring-[var(--positive)]/30"
                    : "bg-[var(--negative)]/15 text-[var(--negative)] ring-[var(--negative)]/30")
                }
              >
                {c.member_count} {c.direction === "buy" ? "buys" : "sells"}
              </span>
            </div>
            {c.size_series.length > 1 && (
              <div className="flex items-center gap-2">
                <Sparkline
                  data={c.size_series}
                  width={120}
                  height={24}
                  color="var(--cluster-active)"
                />
                <span className="num text-[10px] text-[var(--text-tertiary)]">cluster size</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {c.members.slice(0, 6).map((m) => (
                <Link
                  key={m.member_id}
                  to="/members/$id"
                  params={{ id: m.member_id }}
                  className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {m.name.split(" ").pop()}
                </Link>
              ))}
              {c.members.length > 6 && (
                <span className="num text-[10px] text-[var(--text-tertiary)]">
                  +{c.members.length - 6}
                </span>
              )}
            </div>
            {(c.predictive_context.contracts.length > 0 ||
              c.predictive_context.hearings.length > 0 ||
              c.predictive_context.lobbying.length > 0) && (
              <div className="space-y-1 border-t border-[var(--border)] pt-2 text-[10px] text-[var(--text-secondary)]">
                {c.predictive_context.contracts.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-[var(--blue)]/15 px-1 text-[9px] uppercase text-[var(--blue)]">
                      contract
                    </span>
                    <span className="num">
                      ${(c.predictive_context.contracts[0].award_value / 1e6).toFixed(0)}M
                    </span>
                    <span>{c.predictive_context.contracts[0].agency}</span>
                  </div>
                )}
                {c.predictive_context.hearings.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-[var(--cyan)]/15 px-1 text-[9px] uppercase text-[var(--cyan)]">
                      hearing
                    </span>
                    <span className="truncate">{c.predictive_context.hearings[0].topic}</span>
                  </div>
                )}
                {c.predictive_context.lobbying.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-[var(--amber)]/15 px-1 text-[9px] uppercase text-[var(--amber)]">
                      lobby
                    </span>
                    <span className="truncate">{c.predictive_context.lobbying[0].registrant}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <RelTime iso={c.formed_at} />
              <Link
                to="/tickers/$symbol"
                params={{ symbol: c.ticker }}
                className="text-[10px] text-[var(--cyan)] hover:underline"
              >
                open feed →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

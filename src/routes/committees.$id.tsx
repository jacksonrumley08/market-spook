import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCommittee } from "@/api/client";
import { PartyChip } from "@/components/PartyChip";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import type { CommitteeOfficial, CommitteeRole, HearingStatus } from "@/api/types-ui";

export const Route = createFileRoute("/committees/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Committee ${params.id} — CongressTrade Intelligence` },
      {
        name: "description",
        content: `Active roster and recent hearings for committee ${params.id}.`,
      },
    ],
  }),
  component: CommitteeDetail,
});

const ROLE_ORDER: Record<string, number> = { CHAIR: 0, RANKING: 1, EX_OFFICIO: 2, MEMBER: 3 };

function roleLabel(role: CommitteeRole): string {
  if (role === "CHAIR") return "Chair";
  if (role === "RANKING") return "Ranking";
  if (role === "EX_OFFICIO") return "Ex officio";
  if (role === "MEMBER") return "Member";
  return role;
}

function roleClass(role: CommitteeRole): string {
  if (role === "CHAIR") return "text-[var(--text-primary)] bg-[var(--bg-2)]";
  if (role === "RANKING") return "text-[var(--text-primary)] bg-[var(--bg-2)]";
  return "text-[var(--text-tertiary)] bg-transparent";
}

function statusClass(s: HearingStatus): string {
  if (s === "HELD") return "text-[var(--text-secondary)] bg-[var(--bg-2)]";
  if (s === "CANCELLED") return "text-[var(--negative)] bg-[var(--negative)]/10";
  if (s === "POSTPONED") return "text-[var(--text-secondary)] bg-[var(--bg-2)]";
  return "text-[var(--cyan)] bg-[var(--cyan)]/10";
}

function partyCounts(members: CommitteeOfficial[]): { D: number; R: number; I: number; U: number } {
  const out = { D: 0, R: 0, I: 0, U: 0 };
  for (const m of members) {
    if (m.party === "D") out.D += 1;
    else if (m.party === "R") out.R += 1;
    else if (m.party === "I") out.I += 1;
    else out.U += 1;
  }
  return out;
}

function CommitteeDetail() {
  const { id } = Route.useParams();
  const {
    data: c,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["committee", id],
    queryFn: () => getCommittee(id),
  });

  const sortedMembers = useMemo(() => {
    if (!c) return [];
    return [...c.members].sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [c]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <SkeletonRows rows={10} cols={4} />
      </div>
    );
  }
  if (isError || !c) {
    return (
      <div className="rounded border border-[var(--negative)]/40 bg-[var(--negative)]/10 p-4 text-xs text-[var(--text-secondary)]">
        Failed to load committee {id}. {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  const counts = partyCounts(sortedMembers);

  return (
    <div className="space-y-3">
      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-medium text-[var(--text-primary)]">{c.name}</h1>
          <span className="num rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-secondary)]">
            {c.chamber}
          </span>
          {c.code && (
            <span className="num rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-tertiary)]">
              {c.code}
            </span>
          )}
          <span className="num text-[10px] text-[var(--text-tertiary)]">
            {sortedMembers.length} members
          </span>
        </div>
        <div className="num mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--text-tertiary)]">
          <span>
            <span className="text-[var(--blue)]">D</span> {counts.D}
          </span>
          <span>
            <span className="text-[var(--red)]">R</span> {counts.R}
          </span>
          {counts.I > 0 && (
            <span>
              <span className="text-[var(--text-secondary)]">I</span> {counts.I}
            </span>
          )}
          {counts.U > 0 && (
            <span>
              <span className="text-[var(--text-secondary)]">?</span> {counts.U}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="rounded border border-[var(--border)] bg-[var(--bg-1)] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
            <span>Active roster</span>
            <span className="num text-[var(--text-tertiary)]">{sortedMembers.length}</span>
          </div>
          {sortedMembers.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
              No active members on file.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-1.5 text-left">Member</th>
                    <th className="px-3 py-1.5 text-left">Role</th>
                    <th className="px-3 py-1.5 text-left">Aff.</th>
                    <th className="px-3 py-1.5 text-left">Bioguide</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m) => (
                    <tr
                      key={m.member_id}
                      className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          to="/members/$id"
                          params={{ id: m.member_id }}
                          className="text-[var(--text-primary)] hover:underline"
                        >
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={
                            "rounded px-1.5 py-0.5 text-[10px] uppercase " + roleClass(m.role)
                          }
                        >
                          {roleLabel(m.role)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {m.party ? (
                          <PartyChip party={m.party} state={m.state ?? undefined} />
                        ) : (
                          <span className="text-[10px] text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="num px-3 py-1.5 text-[10px] text-[var(--text-tertiary)]">
                        {m.bioguide_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3 lg:col-span-5">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Recent hearings</span>
              <span className="num text-[var(--text-tertiary)]">{c.recent_hearings.length}</span>
            </div>
            {c.recent_hearings.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">
                No recent or upcoming hearings.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]/40">
                {c.recent_hearings.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-[var(--text-primary)] leading-snug">
                        {h.topic}
                      </div>
                      <span
                        className={
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase " +
                          statusClass(h.status)
                        }
                      >
                        {h.status}
                      </span>
                    </div>
                    <div className="num mt-1 flex flex-wrap gap-x-3 text-[10px] text-[var(--text-tertiary)]">
                      <span>
                        <RelTime iso={h.scheduled_at} />
                      </span>
                      <span>{new Date(h.scheduled_at).toISOString().slice(0, 10)}</span>
                      {h.location && <span className="truncate">{h.location}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded border border-dashed border-[var(--border)] bg-[var(--bg-1)] p-3 text-[10px] text-[var(--text-tertiary)]">
            Backend gap: <code className="num">/committees/{"{id}"}</code> does not yet expose
            weekly sector flow or recent cluster trades for this committee.
          </div>
        </div>
      </div>
    </div>
  );
}

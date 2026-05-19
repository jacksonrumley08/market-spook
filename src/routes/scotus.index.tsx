import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listScotusJustices } from "@/api/client";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scotus/")({
  head: () => ({
    meta: [
      { title: "SCOTUS — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "Supreme Court justices with disclosed holdings and transactions. Source: judicial financial disclosures.",
      },
    ],
  }),
  component: ScotusIndex,
});

function ScotusIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["scotus-justices"],
    queryFn: listScotusJustices,
  });

  const items = data ?? [];
  const sorted = [...items].sort((a, b) => {
    // Chief Justice first, then by appointed_year ascending (seniority).
    const aChief = (a.seat_title ?? "").toLowerCase().includes("chief") ? 0 : 1;
    const bChief = (b.seat_title ?? "").toLowerCase().includes("chief") ? 0 : 1;
    if (aChief !== bChief) return aChief - bChief;
    return (a.appointed_year ?? 9999) - (b.appointed_year ?? 9999);
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Supreme Court
        </h1>
        <p className="num text-[10px] text-[var(--text-tertiary)]">
          {items.length} active justices · judicial disclosures only · click for holdings &
          transactions
        </p>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-[var(--text-tertiary)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-1.5 text-left">Justice</th>
                <th className="px-3 py-1.5 text-left">Seat</th>
                <th className="px-3 py-1.5 text-left">Appointed</th>
                <th className="px-3 py-1.5 text-right">Disclosures</th>
                <th className="px-3 py-1.5 text-right">Most recent</th>
                <th className="px-3 py-1.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-3">
                    <SkeletonRows rows={9} cols={6} />
                  </td>
                </tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[var(--text-tertiary)]">
                    No justices on record.
                  </td>
                </tr>
              )}
              {sorted.map((j) => {
                const recent = j.most_recent_disclosure_year ?? null;
                const stale = recent != null && recent < new Date().getUTCFullYear() - 2;
                return (
                  <tr
                    key={j.id}
                    className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        to="/scotus/$justice"
                        params={{ justice: j.id }}
                        className="text-[var(--text-primary)] hover:underline"
                      >
                        {j.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                      {j.seat_title ?? "—"}
                    </td>
                    <td className="num px-3 py-1.5 text-[var(--text-tertiary)]">
                      {j.appointed_year ?? "—"}
                      {j.appointed_by_president && (
                        <span className="num ml-1 text-[9px] text-[var(--text-tertiary)]/70">
                          ({j.appointed_by_president})
                        </span>
                      )}
                    </td>
                    <td className="num px-3 py-1.5 text-right text-[var(--text-secondary)]">
                      {j.disclosure_count ?? 0}
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-1.5 text-right",
                        recent == null
                          ? "text-[var(--text-tertiary)]"
                          : stale
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-secondary)]",
                      )}
                      title={stale ? "Disclosure more than 2 years old" : undefined}
                    >
                      {recent ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-tertiary)]">
                      {j.current_status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

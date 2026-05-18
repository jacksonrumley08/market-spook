import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { listNews } from "@/api/client";
import { RelTime } from "@/components/RelTime";
import { SkeletonRows } from "@/components/SkeletonRows";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 50;

type Search = { page: number };

export const Route = createFileRoute("/news")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const pageRaw = Number(s.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    return { page };
  },
  head: () => ({
    meta: [
      { title: "News — CongressTrade Intelligence" },
      {
        name: "description",
        content:
          "GDELT news articles ingested by the platform. Each article is the source for one or more NEWS_TRADE_PROXIMITY alerts.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: "/news" });
  const offset = (page - 1) * PAGE_LIMIT;

  const newsQ = useQuery({
    queryKey: ["news", page],
    queryFn: () => listNews({ limit: PAGE_LIMIT, offset }),
    placeholderData: (prev) => prev,
  });

  const items = newsQ.data?.items ?? [];
  const hasMore = newsQ.data?.hasMore ?? false;
  const isLoading = newsQ.isLoading;

  const setPage = (next: number) => navigate({ search: { page: next } });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">News</h1>
          <p className="num text-[10px] text-[var(--text-tertiary)]">
            page {page} · {items.length} articles · GDELT-sourced, used by NEWS_TRADE_PROXIMITY
            alerts
          </p>
        </div>
        <Link
          to="/alerts"
          search={{ status: "OPEN", kind: "NEWS_TRADE_PROXIMITY", page: 1 }}
          className="rounded px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:text-[var(--text-primary)]"
        >
          view alerts →
        </Link>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--bg-1)]">
        {isLoading && (
          <div className="p-3">
            <SkeletonRows rows={8} cols={4} />
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-[var(--text-tertiary)]">
            No news articles in this window.
          </div>
        )}
        {items.map((n) => {
          const tone = parseTone(n.tone);
          const headline = n.headline ?? "(no headline)";
          const companies = n.mentioned_companies as Array<Record<string, unknown>>;
          const firstCompany = companies[0];
          const firstCompanyName =
            firstCompany && typeof firstCompany.company_name === "string"
              ? firstCompany.company_name
              : null;
          return (
            <div
              key={n.id}
              className="flex items-center gap-3 border-b border-[var(--border)]/40 px-3 py-2 text-xs hover:bg-[var(--bg-2)]"
            >
              {n.source_url ? (
                <a
                  href={n.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={n.source_url}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded",
                    toneClass(tone),
                  )}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="h-5 w-5 text-[var(--text-tertiary)]">·</span>
              )}
              <span className="num w-16 text-[10px] uppercase text-[var(--text-tertiary)]">
                {n.event_date}
              </span>
              <span className="flex-1 truncate text-[var(--text-primary)]" title={headline}>
                {headline}
              </span>
              {firstCompanyName && (
                <span className="hidden truncate text-[10px] text-[var(--text-secondary)] md:inline-block md:max-w-[200px]">
                  {firstCompanyName}
                  {companies.length > 1 && (
                    <span className="ml-1 text-[var(--text-tertiary)]">
                      +{companies.length - 1}
                    </span>
                  )}
                </span>
              )}
              {n.domain && (
                <span className="hidden text-[10px] text-[var(--text-tertiary)] md:inline">
                  {n.domain}
                </span>
              )}
              {tone != null && (
                <span
                  className={cn("num w-10 text-right text-[10px]", toneClass(tone))}
                  title="GDELT tone score"
                >
                  t{tone.toFixed(1)}
                </span>
              )}
              <RelTime iso={n.ingested_at} className="text-[10px]" />
            </div>
          );
        })}
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← prev
          </button>
          <span className="num">page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!hasMore}
            className="rounded px-2 py-1 ring-1 ring-[var(--border)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}

function parseTone(t: number | string | null | undefined): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function toneClass(t: number | null): string {
  if (t == null) return "text-[var(--text-tertiary)]";
  if (t < -1) return "text-[var(--negative)]";
  if (t > 1) return "text-[var(--positive)]";
  return "text-[var(--text-secondary)]";
}

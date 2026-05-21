import { Link } from "@tanstack/react-router";

// Site-wide footer: required for a product surfacing backtested return claims
// and named individuals' trades. Renders disclaimer, data-source attribution,
// and a not-affiliated-with-USG statement. Pulled out of __root so the home
// hero can also reference it.
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-[var(--border)] bg-[var(--bg-0)]">
      <div className="mx-auto max-w-[1600px] px-4 py-6 text-[11px] leading-relaxed text-[var(--text-secondary)]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <div className="h-2.5 w-2.5 rounded-sm bg-[var(--cyan)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                CongressTrade
              </span>
            </div>
            <p className="mt-2 max-w-xs">
              Open-source intelligence platform that links congressional, federal-official, and
              Supreme Court trading disclosures to votes, hearings, committee jurisdictions,
              contracts, lobbying filings, and news events.
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Data sources
            </div>
            <ul className="mt-2 space-y-0.5">
              <li>House Clerk PTRs · Senate EFD (when accessible)</li>
              <li>Fix the Court (SCOTUS disclosures)</li>
              <li>USAspending (federal contracts)</li>
              <li>Senate LDA (lobbying filings)</li>
              <li>GDELT Doc 2.1 (news events)</li>
              <li>Federal Reserve / FOMC calendar</li>
            </ul>
            <Link
              to="/admin/health"
              className="mt-2 inline-block text-[var(--cyan)] hover:underline"
            >
              Source freshness & ingestion health →
            </Link>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
              Disclaimer
            </div>
            <p className="mt-2">
              <strong className="text-[var(--text-primary)]">
                Not financial advice; for informational and research use only.
              </strong>{" "}
              All metrics — alpha, Sharpe, decay curves, alerts, leaderboards — are computed from
              public records and may contain errors, transcription artifacts, or sampling biases.
              Backtested returns are net of an assumed 10 bps slippage but do not include brokerage
              commissions, taxes, market impact, or signal-flip exits. Past performance does not
              predict future results. Do your own due diligence before acting on any signal surfaced
              here.
            </p>
            <p className="mt-2">
              CongressTrade is not affiliated with, endorsed by, or sponsored by the United States
              Congress, the Supreme Court, the Federal Reserve, or any U.S. Government agency.
              Personal trading disclosures referenced here are matters of public record.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          <span>© {year} CongressTrade Intelligence · Public-records research project</span>
          <span className="num">v1 · audit 2026-05-19</span>
        </div>
      </div>
    </footer>
  );
}

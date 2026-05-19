# Production-Readiness UX Audit — 2026-05-19

_Fresh multi-agent audit (4 parallel sub-agents, file:line anchored). Grounded against live API at `localhost:8002`. Triggered by user reporting "still doesn't feel production ready, 0s and default values, would need a degree to understand this" — despite commit `4b3626c` marking the prior audit closed._

## Headline

**The prior audit closed the route wiring, not the data flow.** Every page now loads end-to-end with real data, but the adapter layer silently writes hardcoded defaults (empty arrays, English placeholder strings, `0` for unpopulated fields), and the engineering vocabulary leaks straight through to the user surface. The user's complaint is accurate.

**Totals: 233 findings — 37 P0, 73 P1, 78 P2, 45 P3.**

| Area | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Dashboard / Members / Leaderboards (4 files) | 12 | 29 | 21 | 9 | 71 |
| Alerts / News / Clusters (3 files) | 7 | 8 | 11 | 8 | 34 |
| Backtest / Committees / SCOTUS / Districts (7 files) | 14 | 22 | 30 | 11 | 77 |
| Shared components / Admin / Tickers / Root / alertKinds (10 files) | 4 | 14 | 16 | 17 | 51 |
| **Total** | **37** | **73** | **78** | **45** | **233** |

---

## The 7 themes that explain every finding

### T1. Adapters silently default-fill missing fields → "looks broken" empties everywhere
This is the single biggest issue and is responsible for ~half of the P0s. The adapters in `src/api/adapters.ts` were modeled on Slice-1 mocks and write hardcoded defaults rather than degrading gracefully.

Examples (each confirmed against live API):
- `adaptMember`: `sector_tilt: []`, `hearing_proximity: []`, `tenure_years: 0`. Member detail page renders an empty pie chart, an empty bar chart, and "0y tenure" on **every** member because the backend never populates these fields.
- `adaptCluster`: `company_name = ticker.symbol`, `size_series: []`, `predictive_context: { contracts: [], hearings: [], lobbying: [] }`. Every cluster card shows "JPM" twice in a row, an empty sparkline next to the label "cluster size", and a bordered empty 8px gap where predictive context was supposed to render.
- `adaptCommittee`: `member_count: 0`, `jurisdiction_summary: ""`, `jurisdiction_sectors: []`. Every committee tile on `/committees` shows "HOUSE · 0 members" and an empty paragraph.
- `adaptAlert.summary`: substitutes `"Member"` / `"a company"` / `"a position"` when name fields are missing. Verified: 100% of NEWS_TRADE_PROXIMITY alert payloads have no `member_name`/`company_name`/`ticker_symbol` → ~1,900 alert rows read `"Member traded a company near a news event"`.

**Fix shape:** either degrade to `—` placeholders at the render layer (so absence is intentional), or — better — server-side enrich the response with the name/series the UI is trying to render.

### T2. Hardcoded English placeholder strings shipped to users
Six distinct instances:
- `index.tsx:472` `name="Member"` (SCOTUS overlap rows — but the justice name isn't plumbed either)
- `index.tsx:498` `name="Fed official"` — **P0 live bug:** API returns `official_name: "Alberto G. Musalem"`; the dashboard hardcodes "Fed official" instead of using `item.member_name`.
- `index.tsx:510` `?? "Lobbying overlap"` as a member name fallback
- `index.tsx:546` `?? "Contract recipient"` for the recipient field
- `index.tsx:605` `<span>Staffer</span>` (no name plumbed at all)
- `adapters.ts:305-337` `"Member"` / `"a company"` / `"a position"` in alert summary templates

These are exactly the "default values" the user pointed at.

### T3. The central kind humanizer is just Title-Case + isn't used consistently
`src/api/alertKinds.ts:34-40` `alertKindLabel()` is the only humanizer in the codebase. Two problems:
1. **It's a Title-Case formatter.** `VOTE_TRADE_INCONSISTENCY` → `"Vote Trade Inconsistency"`. The user can read the words but doesn't know what they mean. The fix is a hand-written dictionary:
   - `VOTE_TRADE_INCONSISTENCY` → "Voted against own holdings"
   - `NEWS_TRADE_PROXIMITY` → "Traded near major news"
   - `STATEMENT_TRADE_CONTRADICTION` → "Statement contradicts trade"
   - etc.
2. **It's bypassed in high-traffic spots.** `alerts.tsx:282` renders raw `{a.kind}` as the chip text. `districts.$state.$district.tsx:255-262` renders raw kinds in monospace. The function is *imported* in those files but only used inside `title=` tooltips that nobody hovers.

Fixing T3 in one pass would silence ~25 of the jargon findings across the dashboard, alerts, districts, news, and member detail pages.

### T4. Internal vocabulary leaked into copy and headers
A non-exhaustive list of strings rendered to users today:
- `"SPEC §17"`, `"Slice 7"`, `"Slice 9"`, `"Slice 16"` (engineering versioning)
- `"Backend gap: /committees/{id} does not yet expose…"` (literal `committees.$id.tsx:236-239` — internal TODO shipped)
- `"source census-cb-2024-cd119"` (raw ingestion-source key on district headers)
- `"score_v2"`, `"composite_score"`, `"α"`, `"z = 6.43σ"`, `"small-n"`, `"Q1"`, `"Bayesian-shrunk toward priors"`
- `"VOTE_TRADE_INCONSISTENCY"`, `"MUTUAL_FUND"`, `"OTHER"`, `"COMPLETED"`, `"Q1_VOTE_TRADE_INCONSISTENCY_90D"` (raw enums as visible text)
- `"BUYs"`, `"n="`, `"n_trades"`, `"pp"`, `"px"`, `"P&L"` (math/trader shorthand)
- The composite-score description at `leaderboards.tsx:42-45` literally reads `0.4·α + 0.3·hit_rate + 0.2·filing_quality + 0.1·alert_density. Bayesian-shrunk toward priors; ~0.5 = neutral.`
- `"empirical edge"`, `"null baseline"`, `"load-bearing finding"`, `"Sharpe gap"`, `"VCR cassette"` (backtest page is the densest)
- `"bioguide id"`, `"GICS sector"`, `"HSBA"`, `"HSAS"` (insider identifiers)

This is the source of "would need a degree to understand this."

### T5. Mock/placeholder pages with no warning banner
- **`/tickers/$symbol` is 100% mock.** `client.ts:343-349` reads `mocks/tickers.json` and never hits a network. **7 routes link into this page** — dashboard, members, clusters, alerts, SCOTUS, districts, Cmd+K. A user clicking AAPL from a real alert sees fake OHLC, fake congressional activity, with no banner.
- **`/committees` index is 100% mock fixture (8 House committees only).** `client.ts:280-286` returns the mock unconditionally even in real-API mode.
- **No `"Demo data"` chip on either.** This is the honesty bug.

### T6. Honesty drift between platform claims and rendered data
- **`backtest.tsx:71` hardcodes "Sharpe 0.678"** in header copy. Live run today returns Sharpe **0.6323** (Δ −0.046). The page's own tolerance is 0.02 — so the live run renders the reference comparison in **warning color**. The "load-bearing finding" banner above promises a number the live page can't reproduce.
- **Dashboard alert sparkline shows 8 days of zeros** (`[0,0,0,0,0,0,0,0,1,4,3567,134,596,128]`) before alert engine v2 went live. Looks like missing data.
- **Admin/health renders `alpha_vantage` and `house_press_releases` as HEALTHY** but their `last_run_at` is null. Source has never run, but the green pill says fine.
- **AlertBell badge in TopNav caps at 100 forever** because the query is `listAlerts({ status: "OPEN", limit: 100 })`. With ~160k OPEN alerts in the system, the bell is meaningless noise.
- **Districts heatmap page is named "heatmap" but renders no map** — it's a sortable table. The PostGIS visualization implied by Slice 16 isn't in the UI.
- **Cluster Fire backtest preset is runnable but returns all zeros.** The page renders the stats grid as `Total return 0%, Max DD −0.00%, Win rate 0.0%, Winners/losers 0/0` — visually identical to a crashed run.

### T7. Empty visual components that look like rendering bugs
- `Sparkline.tsx:17` returns `<div style={{ width, height }} />` (an invisible div) for empty data. This component is rendered in **5+ places** that pass empty arrays:
  - Cluster cards (size_series always `[]`)
  - Leaderboard rows (30d series always `[]`)
  - Members directory α series column
  - Member detail 2×2 α grid
- `members.$id.tsx:269-302` Sector tilt PieChart — `sector_tilt: []` from adapter → renders an empty pie on every member
- `members.$id.tsx:304-342` Hearing-trade proximity BarChart — `hearing_proximity: []` → renders an empty axis on every member
- `FlagBadge.META` defines 7 flag kinds but backend rarely populates them → empty Flags column on `index.tsx`, `members.$id.tsx`, `tickers.$symbol.tsx`

---

## Top-priority P0 fixes (do-now)

Roughly ordered by user-visible impact-per-effort:

1. **Replace `alertKindLabel` with a hand-written friendly-label dictionary** (theme T3). One file edit (`src/api/alertKinds.ts`) kills ~25 jargon findings. Also fix the chip-renders-raw-enum bugs in `alerts.tsx:282` and `districts.$state.$district.tsx:255-262`.
2. **Fix the FOMC `"Fed official"` hardcode** at `index.tsx:498` — change `name="Fed official"` to `name={item.member_name}` (the API already returns it).
3. **Delete the visible engineering-leak strings:** `committees.$id.tsx:236-239` ("Backend gap: …"), `districts.$state.$district.tsx:67-69` ("source census-cb-2024-cd119"), the four "Slice 7/9/16" panel titles in `members.$id.tsx`, and the `0.4·α + 0.3·hit_rate + …` formula at `leaderboards.tsx:42-45`.
4. **Hide-when-empty the analytical widgets that always render empty:** sector tilt pie, hearing-proximity bar, cluster size sparkline, member-detail α 2×2 grid. Either delete or gate on `data.length > 0`. (Better: have backend populate them, but hiding is the safe immediate fix.)
5. **Reconcile the Sharpe 0.678 claim:** either re-anchor `presets.q1_vote_trade.reference_sharpe` to the live value, widen tolerance to ±0.05, or freeze the reference run and store it. The page currently advertises a number it flags itself as off.
6. **Stop showing "0y tenure" on every member** (`members.$id.tsx:174`): if `tenure_years ?? 0`, hide the segment entirely. Backend never populates this field — either drop it from the UI or populate it server-side.
7. **Fix `members.$id.tsx` to actually call `/members/{id}/alpha`, `/decay`, `/quality`, `/district_concentration`** — the prior audit P0s. These were marked done in commit 4b3626c but the score panel still shows derived-from-leaderboard data, and the sector/hearing widgets adapt from `getMember` (which doesn't return those fields). Wire the dedicated endpoints.
8. **Banner the two fully-mock pages:** `/tickers/$symbol` and `/committees` index. Either ship the backend endpoints, or render an unmissable "Demo data — backend endpoint not yet implemented" warning at the top.
9. **Cap or null-check the AlertBell count** (`TopNav.tsx:144`). Either render `99+` once count exceeds 99, scope to `severity ∈ {critical, warning}`, or scope to `created_at > last_seen`.
10. **Filter the broken roster rows out of committee detail** (`committees.$id.tsx:179-183`). ~30 of 59 members on HSBA show `party: null, state: null` (stale roster snapshots from old Congress numbers). Either filter to current Congress or label "Unknown".

---

## Where this audit lives

Per-agent detail (file:line anchored, ~233 findings) was generated by four parallel sub-agents on 2026-05-19. The full per-file findings are available in agent transcripts; this doc consolidates themes and prioritization. Predecessor doc: `audit/AUDIT_FINDINGS.md` (2026-05-18).

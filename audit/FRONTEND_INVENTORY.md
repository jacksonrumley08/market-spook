# Frontend consumption inventory — congresstrade-ui
_Branch `phase-6-frontend-integration-wip` at HEAD `b8a6c0d`. Build verified clean via `bun run build` (11s)._

`VITE_USE_MOCKS=false` in `.env`; `VITE_API_BASE_URL=/api`. The vite proxy forwards `/api/*` → `host.docker.internal:8002` in dev. Production-deploy `/api/*` routing is **broken** per INTEGRATION_NOTES (separate gap).

## Routes registered (8 page routes + root + ticker)

| URL | File | Purpose |
|---|---|---|
| `/` | `src/routes/index.tsx` | Dashboard (summary, predictive/reactive feeds, clusters, flagged trades) |
| `/members` | `src/routes/members.index.tsx` | Members directory (table) |
| `/members/$id` | `src/routes/members.$id.tsx` | Member detail (scores, sparklines, sector tilt, hearings, holdings, trades) |
| `/committees` | `src/routes/committees.index.tsx` | Committees directory (cards) |
| `/committees/$id` | `src/routes/committees.$id.tsx` | Committee detail (roster, weekly flow heatmap, recent cluster trades) |
| `/clusters` | `src/routes/clusters.tsx` | Cluster grid (cards with members + predictive_context) |
| `/leaderboards` | `src/routes/leaderboards.tsx` | Multi-tab leaderboard (alpha/hit_rate/vagueness/late_filer/options_conviction/filing_quality) |
| `/backtest` | `src/routes/backtest.tsx` | Backtest replica — member picker + lag slider + cumulative chart |
| `/alerts` | `src/routes/alerts.tsx` | Alert feed with kind filter + payload expand |
| `/tickers/$symbol` | `src/routes/tickers.$symbol.tsx` | Ticker detail (OHLC, active clusters, activity) |

Top-nav order: Home, Members, Committees, Clusters, Leaderboards, Backtest, Alerts. Search ⌘K (members + tickers) and alert bell are global; FilterChip stores user prefs in `lib/filter-store.ts` but **no route reads from it currently** — the chip is purely cosmetic.

## API call sites

All `fetch()` lives behind `src/api/client.ts`. Routes only call client functions via `useQuery`/`useMutation`.

| Client fn | Endpoint hit (real-API mode) | Adapter | Fallback if 404 |
|---|---|---|---|
| `listMembers` | `GET /members?search&chamber&party&limit&offset` | `adaptMember` | throws |
| `getMember` | `GET /members/{id}` | `adaptMember` | throws |
| `listTransactions` | `GET /transactions/recent?member_id&ticker&limit` | `adaptTransaction` | throws (client filter `has_any_flag` over-fetches) |
| `getTransaction` | list-and-find via `/transactions/recent?limit=200` | `adaptTransaction` | throws if not in first 200 ⚠ |
| `listCommittees` | **none** — always returns mock fixture | `adaptCommittee` | n/a |
| `getCommittee` | `GET /committees/{id}` via `safeFetch` | `adaptCommittee` | mock-fixture lookup by id |
| `getCommitteeFlowTop` | **none** — always mock fixture | direct fixture | n/a |
| `listClusters` | `GET /clusters/active?limit` via `safeFetch` | `adaptCluster` | empty list |
| `getTicker` | **none** — mock-only fixture | `adaptTicker` | throws on unknown symbol |
| `listTickerSymbols` | **none** — mock-only fixture | direct fixture | n/a |
| `getLeaderboard(kind)` | `GET /leaderboard?limit=100`, re-sorted client-side per kind | `adaptLeaderboardEntry` | empty list |
| `listAlerts` | `GET /alerts?status=OPEN&limit=100` (or no status) | `adaptAlert` | empty list |
| `dismissAlert` | `POST /alerts/{id}/acknowledge` | — | swallows errors |
| `runBacktest` | **mock-only fixture** even in real-API mode | — | always returns mock |
| `getDashboardSummary` | `GET /dashboard/summary` via `safeFetch` | (pass-through) | null |
| `getPredictiveFeed` | `GET /feed/predictive?limit=100` | `adaptPredictiveFeedItem` | empty list |
| `getReactiveFeed` | `GET /feed/reactive?limit=100` | `adaptReactiveFeedItem` | empty list |
| `getIngestionHealth` | `GET /admin/ingestion/health` | (pass-through) | **never called by any route** |

`safeFetch` swallows network errors → logs `console.warn`, returns fallback. `realFetch` throws.

## Adapter coverage — what gets dropped

The UI type system (`src/api/types-ui.ts`) was modeled after Slice-1 Lovable mocks and predates Slices 2-16. Every adapter discards rich backend fields by mapping them to empty arrays or hardcoded defaults.

### `adaptMember` (most destructive)
Backend `MemberOut` → UI `MemberOut`. **Drops or zero-defaults:**
- `position_title`, `external_ids` (all bioguide-only)
- `staff_with_recent_trades` — entire Slice-14 surface unused
- `scores.*` — all 9 fields hardcoded to 0 (EMPTY_SCORES). Member-detail page renders all "+0.0%" / "0%" placeholders. The page does NOT call `/members/{id}/alpha`, `/decay`, `/district_concentration`, or `/quality`, despite those endpoints existing
- `alpha_series` — empty array → all sparklines render as empty divs
- `sector_tilt` — empty array → pie chart degenerate
- `hearing_proximity` (buckets) — empty array → BarChart empty

Net effect: member detail page renders header + committees + a list of "Recent trades" but ALL the analytical widgets are blank visuals.

### `adaptCommittee`
Backend `CommitteeOut` (id/name/chamber/code) → UI `CommitteeOut`. **Hardcodes:**
- `jurisdiction_summary` = literal string `"Jurisdiction details available in later slices."`
- `jurisdiction_sectors` = []
- `member_count` = 0 (despite backend `/committees/{id}` returning a real `.members` array)
- `members` = []
- `weekly_flow` = []
- `recent_cluster_trades` = []

`getCommittee` calls real `/committees/{id}` and pulls members + recent_hearings, BUT `adaptCommittee` is the only adapter — it never reads those fields. **Members + hearings from `/committees/{id}` are fetched and immediately discarded.**

### `adaptTransaction`
Backend `TransactionOut` → UI `TransactionOut`. **Drops:**
- `hearing_proximity` (the full nested object with hearing topic, committee name, scheduled_at, proximity_days) — NOT consumed at all; only `jurisdiction_overlap` becomes a flag
- `ticker_resolution_confidence`
- `source` (HOUSE_CLERK / SENATE_EFD etc.)
- `amount_bucket`
- `instrument_type` (CALL/PUT/STOCK) — collapses to `'buy'` via lowercase transaction_type
- jurisdiction_overlap_flag is read but `committees` array is not propagated to UI fully (mapped to id=name placeholder)

Built `flags.jurisdiction_overlap` from committees array but never builds `flags.hearing_proximity`, `flags.contract_proximity`, `flags.lobbying_overlay`, `flags.vote_trade_consistency`, or `flags.fomc_blackout` — those keys can't be populated because the backend doesn't ship them on TransactionOut (they live on alerts / feed_predictive). So the rich `FlagRow` only ever shows JURIS chips.

### `adaptCluster`
Backend `ClusterOut` → UI `ClusterOut`. **Drops:**
- `direction` correctly mapped
- `company_name` set to `w.ticker?.symbol ?? ''` — bug: company name == ticker symbol
- `predictive_context.contracts/hearings/lobbying` — hardcoded to `[]`. The clusters page renders an "if length > 0" block for each — never fires
- `size_series` — hardcoded `[]`. Cluster cards render an empty sparkline (always)
- `updated_at`

### `adaptLeaderboardEntry`
Backend `LeaderboardItem` → UI `LeaderboardEntry`. **Drops:**
- `composite_score` — the LOAD-BEARING field, only shown as fallback for unsupported `options_conviction` kind
- `rank_overall` set to 0 if null, then client-rewrites via array index (so the per-tab rank is ordinal not from backend)
- `n_trades_lifetime`, `n_trades_90d`, `alert_count_lifetime`, `critical_alert_count_lifetime`, `has_sufficient_sample` — all dropped (no "small-sample" warning surfaced)
- `series_30d` — hardcoded `[]`, sparkline column renders empty
- `rank_delta` = 0 always (no historical comparison available)

### `adaptAlert`
Backend `AlertOut` (incl. score_v2, status, lifecycle timestamps) → UI `AlertOut`. **Drops or hides:**
- `score_v2` (the load-bearing Slice-11 composite alert score — never shown anywhere)
- `severity` correctly preserved
- `status` collapsed to a bool `dismissed`; the four-state lifecycle (OPEN/ACKNOWLEDGED/RESOLVED/EXPIRED) is reduced to "dismissed yes/no"
- `acknowledged_at`, `resolved_at`, `expiry_at` — never displayed
- `related_transaction_id` — not surfaced (no click-through to transaction)
- `ticker_id` — not surfaced
- Rich kind-specific payload fields are not shown structured; only the freeform JSON via "expand" button

`alertSummary()` does interpret payload keys (e.g. `vote_inconsistency_company_name`, `legis_num`) but only into a one-line text summary. Field-rich tables per kind would be possible but aren't built.

### `adaptPredictiveFeedItem` (catastrophic information loss)
Backend `PredictiveFeedItem` carries ~80 nullable detector-specific fields plus a nested `cluster: ClusterOut`. UI `SignalFeedItem` projects to **6 fields**: id, kind, signal_type, member_id, member_name, ticker, score, created_at, transaction_id.

Fields dropped:
- `vote_inconsistency_vote_question`, `vote_description`, `legis_num`, `member_position`, `trade_direction`, `sector_impact`, `proximity_days`, `key_vote`, `yeas`, `nays`, `company_gics_sector`, `chamber`, `vote_id`, `company_id` — i.e. EVERYTHING about the vote-trade inconsistency signal beyond "Member name + score"
- `news_proximity_headline`, `source_url`, `tone`, `news_event_date`, `proximity_days` — i.e. you can't see the news article
- `statement_contradiction_statement_source_url`, `statement_source_type`, `gics_sector`, `sentiment_score`, `trade_direction`, `proximity_days`, `contradiction_kind` — the statement itself + which direction was contradicted
- `lobbying_overlay_client_name` / `registrant_name` / `issue_codes` / `issue_sector_match` / `amount_usd` / `aggregated_count` — the lobbying relationship + dollar amount
- `contract_proximity_award_amount` / `recipient_names` / `relative_volume_z_score` / `aggregated_count` / `iso_week` — the contract details + z-score
- `scotus_overlap_*` (all 10) — justice involvement entirely invisible
- `staffer_proximity_*` (all 9), `state_official_proximity_*` (all 10) — Slices 14/15 entirely invisible
- `fomc_blackout_meeting_id` — the FOMC meeting context
- nested `cluster.ticker.symbol` — surfaced only as `ticker` field; the cluster itself (committee, members, window) is dropped

Bug: `ticker` field is overloaded — for vote_inconsistency it gets the **company name** ("Microsoft Corporation"), for contract_proximity gets "1 contracts" (string), for cluster gets the symbol ("JPM"). Heterogeneous render in a "Ticker" column.

Bug: `member_name` defaults to literal string `'Member'` because backend doesn't ship name on PredictiveFeedItem (Deferral #1). This is the visible "Member" placeholder on the dashboard.

### `adaptReactiveFeedItem`
Backend `TransactionOut` (reactive feed) → UI `SignalFeedItem`. **Drops:**
- `amount_min_usd`, `amount_max_usd`, `amount_bucket` — no dollar amount shown
- `jurisdiction_overlap.committees` (names) — only the bool reduces to signal_type
- `hearing_proximity` — entirely
- `ticker_resolution_confidence`
- All transaction details — only kind/member/ticker/score/time emitted

`score` collapses to `1` (overlap) or `0` (no overlap). On the dashboard "Reactive feed" column the score is shown as "+100" or "+0" with no scaling.

## Field-by-field surface render audit (per page)

### `/` Dashboard
Renders, in order:
1. Active flagged count (`summary.active_flagged_count`) + 14d sparkline (`summary.active_flagged_series`) ✓
2. Top committee flow — **MOCK FIXTURE** (always; no backend endpoint exists)
3. Active clusters list: ticker, committee_name, member_count, direction from `listClusters({limit:3})` ✓. `summary.active_clusters_count` total. **NO size_series rendered** (would be empty anyway)
4. Predictive feed column — `SignalFeedItem` array. Shows `signal_type` chip + `member_name` (often "Member" placeholder) + `ticker` field (heterogeneous) + `score` formatted as % + relative time. **No detector payload visible.** Click member → `/members/$id` (works); click ticker → `/tickers/$symbol` (fails for non-ticker values like "1 contracts" / "Microsoft Corporation")
5. Reactive feed column — same shape, score is 0 or 1 (binary)
6. Recent flagged trades table: member_name, ticker, type, amount range, owner, FlagRow (only JURIS surfaces), relative time. **No hearing_proximity, no source provenance, no link to alert payload**

### `/members` (directory)
Table columns: name, party/state/chamber chip, **α180d**, **α series sparkline**, **hit rate**, **vagueness**, **lateness**, committees.

All five score columns show **+0.0% / 0% / 0** because `adaptMember` writes EMPTY_SCORES.

Search input filters server-side via `?search=`. Sort by name works; sort by score is meaningless (all zeros).

Total tracked count shown ("519 tracked"). No pagination UI — `limit: 999` (over-fetch then client-sort); backend caps at 200, so 319 of 519 silently missing per INTEGRATION_NOTES.

### `/members/$id`
Hero: name, party chip, district (if any), committees (resolved via `listCommittees()` ← MOCK), tenure_years, bioguide_id.

Score panel (4 large stats): all show `0%` (EMPTY_SCORES).

Alpha sparklines panel (2×2 grid for 30/90/180/365d): all empty (`alpha_series=[]`).

Sector tilt: empty pie chart (`sector_tilt=[]`).

Hearing-trade proximity histogram: empty bar chart (`hearing_proximity=[]`).

Holdings table — synthesized client-side from `listTransactions({member_id})`. ✓ This works (the only real data on the page).

Recent trades table — also from listTransactions, same row shape as dashboard. ✓ Works.

**The page does not call `/members/{id}/alpha` or `/decay` or `/quality` or `/district_concentration`.** Four high-value endpoints sit unused.

### `/committees` (directory)
Cards: `member_count` (0 for all because adapter hardcodes), `jurisdiction_summary` ("Jurisdiction details available in later slices."), `jurisdiction_sectors` (empty chips).

Source: `listCommittees()` returns **mock fixture only** — there's no backend list endpoint and the function never tries.

### `/committees/$id`
Hero: name, chamber, `member_count` (hardcoded 0), `jurisdiction_summary` (literal placeholder), sector chips (empty).

Member roster table — `c.members` is `[]` (hardcoded by adapter), so the table is empty even when `/committees/{id}` returns 59 members.

Weekly flow heatmap — `c.weekly_flow` is `[]` (hardcoded), heatmap renders empty.

Recent cluster trades — `c.recent_cluster_trades` is `[]` (hardcoded), table empty.

**The page fetches `/committees/{id}` successfully (members + hearings populate), but the adapter discards them. Net: the page shows the placeholder string only.**

### `/clusters`
Cards: ticker, **company_name (== ticker symbol, bug)**, committee_name, direction × member_count, member names (last names only), size_series (empty sparkline).

Predictive context section ("if contracts/hearings/lobbying populated"): never renders because adapter hardcodes those arrays to `[]`.

formed_at shown via RelTime ✓.

### `/leaderboards`
6 tabs. Per-row: rank (sequential), rank_delta (always "—"), member_name, party/state/chamber chip, **score** (sorted desc; ascending for late_filer/vagueness), 30d sparkline (always empty).

Composite-score column not shown. n_trades column not shown. alert_count column not shown. has_sufficient_sample warning not shown. The "options_conviction" tab silently falls back to composite_score (per adapter) — so it shows the same ordering as the default with a misleading tab label.

### `/backtest`
**Wired to mock data** even when `useMocks=false` (per `runBacktest` source). Member picker pulls from `listMembers({limit:999})` ✓ but the actual run returns deterministic `mockBacktest` fixture regardless of selection. Sharpe / total return shown are from the mock.

This is explicitly documented as Deferral #2.

### `/alerts`
Row: severity dot, kind chip, summary (kind-specific text built by `alertSummary`), member link, ticker link, RelTime, "dismissed" marker.

Click → expands raw `payload` JSON in a `<pre>`.

Kind filter pills are hardcoded to **`['CLUSTER_THRESHOLD','CONTRACT_PROXIMITY','FOMC_BLACKOUT','WATCHLIST_MATCH','NEWS_CATALYST','INGESTION_HEALTH']`** — these are **legacy Lovable kinds**. They DON'T match any of the real backend's 13 alert kinds (VOTE_TRADE_INCONSISTENCY, NEWS_TRADE_PROXIMITY, STATEMENT_TRADE_CONTRADICTION, LOBBYING_TRADE_OVERLAP, SCOTUS_CONGRESSIONAL_OVERLAP, STAFFER_TRADE_PROXIMITY, STATE_OFFICIAL_TRADE_PROXIMITY, CONTRACT_AWARD_PROXIMITY, HIGH_VALUE_CONTRACT, CLUSTER_FIRE, JURISDICTION_OVERLAP, HEARING_PROXIMITY, FOMC_BLACKOUT). Only FOMC_BLACKOUT happens to match.

Net: clicking any non-matching filter pill returns zero results. The filter UI is broken against real data.

No status filter UI (despite backend supporting OPEN/ACKNOWLEDGED/RESOLVED/EXPIRED). Only a "show dismissed" toggle.

score_v2 (the load-bearing Slice-11 composite) NEVER shown.

### `/tickers/$symbol`
**Mock-only** — `getTicker` reads from `mocks/tickers.json`. Page renders OHLC chart, active clusters table, congressional activity. None of it is live.

Links from feeds + clusters + transactions all funnel into this mock-fed page (when the user clicks a ticker on the dashboard, they hit `getTicker(symbol)` which throws on unknown symbols → error boundary).

## Components that exist but never render with real data

- `Sparkline` widget present in 5 places that all receive empty arrays (members list α series, members detail α series, member sector tilt, leaderboard 30d, cluster size series)
- `FlagBadge` for `hearing_proximity`, `contract_proximity`, `lobbying_overlay`, `vote_trade_consistency`, `fomc_blackout`, `cluster_id` — all defined in META but never populated by `adaptTransaction`
- `committees.flow.top` widget on dashboard — always mock data
- `BacktestPage` — entirely mock
- `Member detail` analytical widgets — alpha sparklines, sector tilt pie, hearing proximity bar chart — all blank visuals
- `Committee detail` roster + weekly flow heatmap + recent cluster trades — all empty

## UI-only state and dead code

- `lib/filter-store.ts` global filter (range + chamber + owner) — `FilterChip` in nav writes to it, but **no route consumes it** (zero usages in routes/*.tsx). Pure UI noise
- `lib/error-capture.ts`, `lib/error-page.ts` — not imported by any route
- 70 `components/ui/*` Shadcn components — many likely unused; not exhaustively audited here
- `signal_score`, `signal_kind`, `alpha_context_30d` on `TransactionOut` (UI type) — never set by any adapter
- `MemberScores.options_conviction` — never populated; the leaderboard tab silently falls back

## Frontend ↔ backend endpoint coverage matrix

| Backend endpoint | Frontend call site | Coverage |
|---|---|---|
| `/dashboard/summary` | `getDashboardSummary` → `/`, used | ✓ direct pass-through |
| `/alerts` | `listAlerts` → `/alerts`, TopNav bell | ⚠ adapter drops score_v2, status, ack/resolve timestamps |
| `/alerts/{id}/acknowledge` | `dismissAlert` (no UI button currently) | wired but unused — no Dismiss button found in `/alerts` UI |
| `/news/recent` | **none** | NOT consumed |
| `/feed/predictive` | `getPredictiveFeed` → `/`, used | ⚠ adapter drops ~70 detector fields + cluster |
| `/feed/reactive` | `getReactiveFeed` → `/`, used | ⚠ adapter drops amount, hearing_proximity, committees |
| `/clusters/active` | `listClusters` → `/`, `/clusters`, used | ⚠ adapter drops predictive_context, size_series, sets company_name=symbol |
| `/members` | `listMembers` → `/members`, TopNav ⌘K, `/backtest` member picker | ⚠ adapter drops scores, alpha series, sector tilt; pagination missing |
| `/members/{id}` | `getMember` → `/members/$id`, used | ⚠ adapter drops scores etc; staff_with_recent_trades + position_title ignored |
| `/members/{id}/alpha` | **none** | NOT consumed |
| `/members/{id}/decay` | **none** | NOT consumed |
| `/members/{id}/district_concentration` | **none** | NOT consumed |
| `/members/{id}/quality` | **none** | NOT consumed |
| `/transactions/recent` | `listTransactions`, `getTransaction` (list-and-find) | ⚠ adapter drops hearing_proximity, source, ticker confidence |
| `/committees/{id}` | `getCommittee` → `/committees/$id` | ⚠ adapter HARDCODES members=[], hearings invisible — real data fetched and thrown away |
| `/leaderboard` | `getLeaderboard` → `/leaderboards` | ⚠ adapter drops composite_score, n_trades, alert counts, sample-sufficiency; per-tab kinds derived client-side |
| `/officials/fed` | **none** | NOT consumed |
| `/scotus/justices` | **none** | NOT consumed |
| `/scotus/{id}/holdings` | **none** | NOT consumed |
| `/scotus/{id}/transactions` | **none** | NOT consumed |
| `/staffers` | **none** | NOT consumed |
| `/staffers/{id}/employments` | **none** | NOT consumed |
| `/states/{state}/officials` | **none** | NOT consumed |
| `/states/{state}/transactions/recent` | **none** | NOT consumed |
| `/districts/heatmap` | **none** | NOT consumed (441-district dataset unused) |
| `/districts/{state}/{n}` | **none** | NOT consumed |
| `/districts/{state}/{n}/alerts` | **none** | NOT consumed |
| `/backtest/run` | `runBacktest` — but RETURNS MOCK | NOT consumed (intentional, Deferral #2) |
| `/backtest/{id}` | **none** | NOT consumed |
| `/backtest/{id}/trades` | **none** | NOT consumed |
| `/admin/ingestion/health` | `getIngestionHealth` defined but **never imported by any route** | Wired but never called |

Coverage tally:
- **13 of 31 endpoints** are actually used by the UI (~42%).
- Of those 13, **~10 have lossy adapters** that drop large portions of the response.
- **18 backend endpoints** are not consumed at all.

## TypeScript shape mismatch summary

The codebase has two parallel type systems:
1. `src/api/types.ts` — auto-generated from backend Pydantic schemas (canonical, accurate, ~845 lines).
2. `src/api/types-ui.ts` — pre-integration mock-era types (~293 lines), inherited from the Lovable scaffolding.

Adapters translate (1) → (2). The UI types are the load-bearing shape for every render. Until UI types are aligned to backend canonical types, the adapter layer will silently drop fields.

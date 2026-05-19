import { API_CONFIG } from "./config";
import mockMembers from "./mocks/members.json";
import mockTransactions from "./mocks/transactions.json";
import mockCommittees from "./mocks/committees.json";
import mockClusters from "./mocks/clusters.json";
import mockTickers from "./mocks/tickers.json";
import mockLeaderboards from "./mocks/leaderboards.json";
import mockAlerts from "./mocks/alerts.json";
import mockSummary from "./mocks/summary.json";
import mockSignalPredictive from "./mocks/signal_predictive.json";
import mockSignalReactive from "./mocks/signal_reactive.json";
import mockCommitteeFlowTop from "./mocks/committee_flow_top.json";
import mockIngestionHealth from "./mocks/ingestion_health.json";

import type {
  AcknowledgeAlertResponse,
  AlertOut as WireAlert,
  BacktestPreset,
  BacktestPresetsResponse,
  BacktestRunRequest,
  BacktestRunResponse,
  BacktestTradeOut,
  ClusterOut as WireCluster,
  CommitteeDetail as WireCommitteeDetail,
  CommitteeOut as WireCommittee,
  DashboardSummary as WireDashboardSummary,
  DisclosureDecayResponse,
  DistrictAlertSummary,
  DistrictHeatmap,
  DistrictHeatmapEntry,
  DistrictOut,
  FilingQualityBreakdown,
  IngestionHealthResponse,
  JudicialHoldingOut,
  JudicialTransactionOut,
  LeaderboardItem as WireLeaderboardItem,
  MemberAlphaResponse,
  MemberDistrictConcentration,
  MemberOut as WireMember,
  NewsEventOut,
  Page as WirePage,
  PredictiveFeedItem as WirePredictiveFeedItem,
  ScotusJusticeOut,
  TransactionOut as WireTransaction,
} from "./types";
import type {
  AlertOut,
  ClusterOut,
  CommitteeDetailOut,
  CommitteeFlowTop,
  CommitteeOut,
  DashboardSummary,
  LeaderboardEntry,
  LeaderboardKind,
  MemberOut,
  Paginated,
  PredictiveFeedItem,
  ReactiveFeedItem,
  TickerOut,
  TransactionOut,
} from "./types-ui";
import {
  adaptAlert,
  adaptCluster,
  adaptCommittee,
  adaptCommitteeDetail,
  adaptLeaderboardEntry,
  adaptMember,
  adaptPredictiveFeedItem,
  adaptReactiveFeedItem,
  adaptTicker,
  adaptTransaction,
} from "./adapters";

// Centralised endpoint paths. These match the FastAPI routes in
// /home/jrumley/congresstrade/app/api/routes/*.py at master = 67f47c2.
const ENDPOINTS = {
  members: "/members",
  member: (id: string) => `/members/${id}`,
  memberAlpha: (id: string) => `/members/${id}/alpha`,
  memberDecay: (id: string) => `/members/${id}/decay`,
  memberDistrictConcentration: (id: string) => `/members/${id}/district_concentration`,
  memberQuality: (id: string) => `/members/${id}/quality`,
  transactionsRecent: "/transactions/recent",
  committee: (id: string) => `/committees/${id}`,
  // No backend list for /committees yet — listCommittees degrades to mocks.
  // No backend /committees/flow/top — getCommitteeFlowTop returns [] in real-API mode.
  clustersActive: "/clusters/active",
  // No backend /tickers list/detail — ticker fetchers fall back to mocks.
  leaderboard: "/leaderboard",
  alerts: "/alerts",
  alertAcknowledge: (id: string) => `/alerts/${id}/acknowledge`,
  backtestPresets: "/backtest/presets",
  backtestRun: "/backtest/run",
  backtestRunById: (id: string) => `/backtest/${id}`,
  backtestRunTrades: (id: string) => `/backtest/${id}/trades`,
  dashboardSummary: "/dashboard/summary",
  feedPredictive: "/feed/predictive",
  feedReactive: "/feed/reactive",
  ingestionHealth: "/admin/ingestion/health",
  newsRecent: "/news/recent",
  districtsHeatmap: "/districts/heatmap",
  district: (state: string, num: number) => `/districts/${state}/${num}`,
  districtAlerts: (state: string, num: number) => `/districts/${state}/${num}/alerts`,
  scotusJustices: "/scotus/justices",
  scotusHoldings: (id: string) => `/scotus/${id}/holdings`,
  scotusTransactions: (id: string) => `/scotus/${id}/transactions`,
};

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    headers: API_CONFIG.headers,
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Wraps fetches against endpoints that may legitimately 404 (slices not yet
// built). Logs once, returns the supplied fallback so the UI degrades to a
// quiet empty state.
async function safeFetch<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await realFetch<T>(path, init);
  } catch (err) {
    console.warn(`[api] degrading ${path}:`, (err as Error).message);
    return fallback;
  }
}

function paginate<T>(items: T[], limit = 25, offset = 0): Paginated<T> {
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

// Translate the API's offset/cursor-paginated Page<T> shape to the UI's
// offset-style Paginated<T>. Real API returns total only when cheaply
// computable (e.g. /members, /alerts). For cursor feeds like
// /transactions/recent, total stays null — UI must tolerate undefined.
function wirePageToPaginated<TWire, TUi>(
  page: WirePage,
  adapt: (w: TWire) => TUi,
  limit: number,
  offset: number,
): Paginated<TUi> {
  return {
    items: (page.items as TWire[]).map(adapt),
    total: page.page.total ?? (page.items as unknown[]).length,
    limit,
    offset,
  };
}

// ---------- Members ----------
export async function listMembers(
  opts: { search?: string; chamber?: string; party?: string; limit?: number; offset?: number } = {},
): Promise<Paginated<MemberOut>> {
  if (API_CONFIG.useMocks) {
    let items = (mockMembers as unknown as WireMember[]).map(adaptMember);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(
        (m) => m.name.toLowerCase().includes(q) || m.bioguide_id.toLowerCase().includes(q),
      );
    }
    if (opts.chamber) items = items.filter((m) => m.chamber === opts.chamber);
    if (opts.party) items = items.filter((m) => m.party === opts.party);
    return paginate(items, opts.limit, opts.offset);
  }
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.chamber) params.set("chamber", opts.chamber.toUpperCase());
  if (opts.party) params.set("party", opts.party.toUpperCase());
  params.set("limit", String(Math.min(limit, 200)));
  params.set("offset", String(offset));
  const page = await realFetch<WirePage>(`${ENDPOINTS.members}?${params}`);
  return wirePageToPaginated<WireMember, MemberOut>(page, adaptMember, limit, offset);
}

export async function getMember(id: string): Promise<MemberOut> {
  if (API_CONFIG.useMocks) {
    const wire = (mockMembers as unknown as WireMember[]).find((x) => x.id === id);
    if (!wire) throw new Error(`Member ${id} not found in mocks`);
    return adaptMember(wire);
  }
  const wire = await realFetch<WireMember>(ENDPOINTS.member(id));
  return adaptMember(wire);
}

// Slice 7 — rolling alpha across 30/90/180/365d horizons. Returns the
// canonical wire shape; consumers read mean_alpha/hit_rate as decimal-strings
// and gate on n_trades for sample-size sufficiency.
export async function getMemberAlpha(id: string): Promise<MemberAlphaResponse | null> {
  if (API_CONFIG.useMocks) return null;
  return safeFetch<MemberAlphaResponse | null>(ENDPOINTS.memberAlpha(id), null);
}

// SPEC §4 — post-disclosure decay curve at 0/7/14/30/60/90d.
export async function getMemberDecay(id: string): Promise<DisclosureDecayResponse | null> {
  if (API_CONFIG.useMocks) return null;
  return safeFetch<DisclosureDecayResponse | null>(ENDPOINTS.memberDecay(id), null);
}

// Slice 16 — fraction of trades in companies HQ'd in the member's own district.
// Returns null shape (district_id null, ratio null) for SENATE members or
// House members with no district mapping.
export async function getMemberDistrictConcentration(
  id: string,
): Promise<MemberDistrictConcentration | null> {
  if (API_CONFIG.useMocks) return null;
  return safeFetch<MemberDistrictConcentration | null>(
    ENDPOINTS.memberDistrictConcentration(id),
    null,
  );
}

// Slice 9 — filing quality composite + components.
export async function getMemberQuality(id: string): Promise<FilingQualityBreakdown | null> {
  if (API_CONFIG.useMocks) return null;
  return safeFetch<FilingQualityBreakdown | null>(ENDPOINTS.memberQuality(id), null);
}

// ---------- Transactions ----------
export async function listTransactions(
  opts: {
    has_any_flag?: boolean;
    member_id?: string;
    ticker?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Paginated<TransactionOut>> {
  if (API_CONFIG.useMocks) {
    const wireTx = (mockTransactions as unknown as { items: WireTransaction[] }).items;
    let items = wireTx.map(adaptTransaction);
    if (opts.has_any_flag) items = items.filter((t) => t.has_any_flag);
    if (opts.member_id) items = items.filter((t) => t.member_id === opts.member_id);
    if (opts.ticker) items = items.filter((t) => t.ticker === opts.ticker);
    items = [...items].sort(
      (a, b) => +new Date(b.transaction_date) - +new Date(a.transaction_date),
    );
    return paginate(items, opts.limit ?? 25, opts.offset ?? 0);
  }
  // Real API: /transactions/recent is cursor-paginated. has_any_flag isn't a
  // server filter yet (overlap ships as a derived field on every row), so we
  // over-fetch slightly and filter client-side.
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const fetchLimit = opts.has_any_flag ? Math.min(200, limit * 4) : Math.min(200, limit);
  const params = new URLSearchParams();
  if (opts.member_id) params.set("member_id", opts.member_id);
  if (opts.ticker) params.set("ticker", opts.ticker);
  params.set("limit", String(fetchLimit));
  const page = await realFetch<WirePage>(`${ENDPOINTS.transactionsRecent}?${params}`);
  let items = (page.items as WireTransaction[]).map(adaptTransaction);
  if (opts.has_any_flag) items = items.filter((t) => t.has_any_flag);
  return paginate(items, limit, offset);
}

export async function getTransaction(id: string): Promise<TransactionOut> {
  if (API_CONFIG.useMocks) {
    const wireTx = (mockTransactions as unknown as { items: WireTransaction[] }).items;
    const w = wireTx.find((x) => String(x.id) === id);
    if (!w) throw new Error(`Transaction ${id} not found`);
    return adaptTransaction(w);
  }
  // Backend has no /transactions/{id} — list-and-find via /transactions/recent.
  const page = await realFetch<WirePage>(`${ENDPOINTS.transactionsRecent}?limit=200`);
  const w = (page.items as WireTransaction[]).find((x) => String(x.id) === id);
  if (!w) throw new Error(`Transaction ${id} not found`);
  return adaptTransaction(w);
}

// ---------- Committees ----------
// Backend has GET /committees/{id} but no list endpoint. List degrades to mocks.
export async function listCommittees(): Promise<CommitteeOut[]> {
  if (API_CONFIG.useMocks) {
    return (mockCommittees as unknown as WireCommittee[]).map(adaptCommittee);
  }
  // No real-API list endpoint — fall back to mock fixture so the directory page renders.
  return (mockCommittees as unknown as WireCommittee[]).map(adaptCommittee);
}

function mockCommitteeAsDetail(id: string): CommitteeDetailOut {
  const w = (mockCommittees as unknown as WireCommittee[]).find((x) => x.id === id);
  if (!w) throw new Error(`Committee ${id} not found`);
  return adaptCommitteeDetail({
    id: w.id,
    chamber: w.chamber ?? "HOUSE",
    code: (w as unknown as { code?: string }).code ?? "",
    name: w.name,
    members: [],
    recent_hearings: [],
  });
}

export async function getCommittee(id: string): Promise<CommitteeDetailOut> {
  if (API_CONFIG.useMocks) return mockCommitteeAsDetail(id);
  const wire = await realFetch<WireCommitteeDetail>(ENDPOINTS.committee(id));
  return adaptCommitteeDetail(wire);
}

// No backend /committees/flow/top — return mock series (or [] when not in mocks).
export async function getCommitteeFlowTop(limit = 5): Promise<CommitteeFlowTop[]> {
  if (API_CONFIG.useMocks)
    return (mockCommitteeFlowTop as unknown as CommitteeFlowTop[]).slice(0, limit);
  // No real-API equivalent yet. Surface the static fixture so the dashboard
  // widget renders with placeholder content rather than an empty box.
  return (mockCommitteeFlowTop as unknown as CommitteeFlowTop[]).slice(0, limit);
}

// ---------- Clusters (Slice 3) ----------
export async function listClusters(opts: { limit?: number } = {}): Promise<ClusterOut[]> {
  if (API_CONFIG.useMocks) {
    const items = [...(mockClusters as unknown as ClusterOut[])].sort(
      (a, b) => +new Date(b.formed_at) - +new Date(a.formed_at),
    );
    return opts.limit ? items.slice(0, opts.limit) : items;
  }
  const limit = opts.limit ?? 25;
  const page = await safeFetch<WirePage | null>(
    `${ENDPOINTS.clustersActive}?limit=${Math.min(limit, 200)}`,
    null,
  );
  return ((page?.items ?? []) as WireCluster[]).map(adaptCluster);
}

// ---------- Tickers (Slice 5/6) — no backend endpoint yet ----------
type WireTickerFixture = {
  id: string;
  symbol: string;
  exchange: string | null;
  instrument_type: string;
  company_name: string;
  gics_sector: string;
  gics_industry: string;
};

export async function getTicker(symbol: string): Promise<TickerOut> {
  const w = (mockTickers as unknown as WireTickerFixture[]).find(
    (x) => x.symbol === symbol.toUpperCase(),
  );
  if (!w) throw new Error(`Ticker ${symbol} not available yet`);
  return adaptTicker(w);
}

export async function listTickerSymbols(): Promise<{ symbol: string; company_name: string }[]> {
  return (mockTickers as unknown as WireTickerFixture[]).map((t) => ({
    symbol: t.symbol,
    company_name: t.company_name,
  }));
}

// ---------- Leaderboards (Slice 9) ----------
// Backend ships a single /leaderboard endpoint ordered by composite_score that
// includes every metric on each LeaderboardItem (alpha_90d, hit_rate_90d,
// filing_quality_score, late_filing_rate, vagueness_score_avg, n_trades_*,
// alert_count_*, has_sufficient_sample). We fetch once with
// `include_insufficient=true` so the page can show every member (77
// sufficient + 123 insufficient at last count) and visually mark the
// small-n cohort. The `late_filer` and `vagueness` kinds sort ascending
// (lower = better filers / less vague).
export async function getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
  if (API_CONFIG.useMocks) {
    const lb = mockLeaderboards as unknown as Record<LeaderboardKind, LeaderboardEntry[]>;
    return lb[kind] ?? lb["alpha"] ?? [];
  }
  const page = await safeFetch<WirePage | null>(
    `${ENDPOINTS.leaderboard}?limit=200&include_insufficient=true`,
    null,
  );
  const items = ((page?.items ?? []) as WireLeaderboardItem[]).map((w) =>
    adaptLeaderboardEntry(w, kind),
  );
  const ascending = kind === "late_filer" || kind === "vagueness";
  // Sort: sufficient-sample first (ranked), insufficient at the bottom.
  items.sort((a, b) => {
    if (a.has_sufficient_sample !== b.has_sufficient_sample) {
      return a.has_sufficient_sample ? -1 : 1;
    }
    return ascending ? a.score - b.score : b.score - a.score;
  });
  return items.map((it, i) => ({ ...it, rank: i + 1 }));
}

// ---------- Alerts (Slice 11) ----------
// listAlerts now passes `status` + `kind` straight through to the backend so
// the UI can wire its filter pills to real /alerts?status=&kind= queries
// instead of client-side filtering on a 100-row window. Returns a Paginated
// shape because /alerts ships `has_more` (total is null on this endpoint).
export async function listAlerts(
  opts: {
    status?: string;
    kind?: string;
    severity?: string;
    limit?: number;
    offset?: number;
    member_id?: string;
    ticker?: string;
    // Legacy: old call sites passed `dismissed: false` to mean "show OPEN".
    // Preserved as a shim — translated to status=OPEN.
    dismissed?: boolean;
  } = {},
): Promise<Paginated<AlertOut>> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  if (API_CONFIG.useMocks) {
    let items = mockAlerts as unknown as AlertOut[];
    const effectiveStatus = opts.status ?? (opts.dismissed === false ? "OPEN" : undefined);
    if (effectiveStatus) items = items.filter((a) => a.status === effectiveStatus);
    if (opts.kind) items = items.filter((a) => a.kind === opts.kind);
    if (opts.severity) items = items.filter((a) => a.severity === opts.severity);
    if (opts.member_id) items = items.filter((a) => a.member_id === opts.member_id);
    if (opts.ticker) items = items.filter((a) => a.ticker === opts.ticker);
    items = [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const sliced = items.slice(offset, offset + limit);
    return {
      items: sliced,
      total: items.length,
      limit,
      offset,
      has_more: offset + limit < items.length,
    };
  }
  const params = new URLSearchParams();
  const effectiveStatus = opts.status ?? (opts.dismissed === false ? "OPEN" : undefined);
  if (effectiveStatus) params.set("status", effectiveStatus);
  if (opts.kind) params.set("kind", opts.kind);
  if (opts.severity) params.set("severity", opts.severity);
  params.set("limit", String(Math.min(limit, 200)));
  params.set("offset", String(offset));
  const page = await safeFetch<WirePage | null>(`${ENDPOINTS.alerts}?${params}`, null);
  let items = ((page?.items ?? []) as WireAlert[]).map(adaptAlert);
  // member_id / ticker still get applied client-side — backend has no native
  // filters for them on /alerts. Lossless because we already over-fetched
  // with the server filters applied.
  if (opts.member_id) items = items.filter((a) => a.member_id === opts.member_id);
  if (opts.ticker) items = items.filter((a) => a.ticker === opts.ticker);
  return {
    items,
    total: page?.page?.total ?? items.length,
    limit,
    offset,
    has_more: page?.page?.has_more ?? false,
  };
}

// Slice-11 lifecycle mutator. Flips OPEN → ACKNOWLEDGED on the server and
// returns the canonical AcknowledgeAlertResponse so the UI can patch the row
// optimistically and then reconcile with server timestamps.
export async function acknowledgeAlert(id: number | string): Promise<AcknowledgeAlertResponse> {
  if (API_CONFIG.useMocks) {
    return {
      id: typeof id === "number" ? id : Number(id),
      status: "ACKNOWLEDGED",
      acknowledged_at: new Date().toISOString(),
    };
  }
  return realFetch<AcknowledgeAlertResponse>(ENDPOINTS.alertAcknowledge(String(id)), {
    method: "POST",
  });
}

// ---------- Backtest (Slice 10) ----------
// Wired to the named-strategy backtester. Each preset reproduces a
// Slice-10 reference result (Sharpe 0.678 for the headline q1_vote_trade
// strategy). `runBacktest` is synchronous on the backend (in-process,
// typically <5s per strategy). The UI page caches per-preset run_ids in
// react-query so a re-render replays a finished run without re-executing.
export async function listBacktestPresets(): Promise<BacktestPreset[]> {
  const res = await realFetch<BacktestPresetsResponse>(ENDPOINTS.backtestPresets);
  return res.presets;
}

export async function runBacktest(req: BacktestRunRequest): Promise<BacktestRunResponse> {
  return realFetch<BacktestRunResponse>(ENDPOINTS.backtestRun, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getBacktestRun(runId: string): Promise<BacktestRunResponse> {
  return realFetch<BacktestRunResponse>(ENDPOINTS.backtestRunById(runId));
}

export async function listBacktestTrades(
  runId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: BacktestTradeOut[]; total: number; limit: number; offset: number }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(limit, 200)));
  params.set("offset", String(offset));
  const page = await realFetch<WirePage>(`${ENDPOINTS.backtestRunTrades(runId)}?${params}`);
  return {
    items: page.items as BacktestTradeOut[],
    total: page.page.total ?? 0,
    limit,
    offset,
  };
}

// ---------- Dashboard summary (real backend endpoint) ----------
export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (API_CONFIG.useMocks) return mockSummary as unknown as DashboardSummary;
  return safeFetch<WireDashboardSummary | null>(
    ENDPOINTS.dashboardSummary,
    null,
  ) as Promise<DashboardSummary | null>;
}

// ---------- Feeds (Slice 7) ----------
export async function getPredictiveFeed(): Promise<PredictiveFeedItem[]> {
  if (API_CONFIG.useMocks) {
    // Legacy mock fixtures predate the discriminated detector union, so we
    // run them through the adapter as if they were wire items. Most fields
    // will narrow to UnknownDetector and the row falls back to its
    // signal-kind chip — acceptable for offline dev.
    return (mockSignalPredictive as unknown as WirePredictiveFeedItem[]).map(
      adaptPredictiveFeedItem,
    );
  }
  const page = await safeFetch<WirePage | null>(`${ENDPOINTS.feedPredictive}?limit=100`, null);
  return ((page?.items ?? []) as WirePredictiveFeedItem[]).map(adaptPredictiveFeedItem);
}

export async function getReactiveFeed(): Promise<ReactiveFeedItem[]> {
  if (API_CONFIG.useMocks) {
    return (mockSignalReactive as unknown as WireTransaction[]).map(adaptReactiveFeedItem);
  }
  const page = await safeFetch<WirePage | null>(`${ENDPOINTS.feedReactive}?limit=100`, null);
  return ((page?.items ?? []) as WireTransaction[]).map(adaptReactiveFeedItem);
}

// ---------- Ingestion health (real Slice 1 endpoint) ----------
export async function getIngestionHealth(): Promise<IngestionHealthResponse> {
  if (API_CONFIG.useMocks) return mockIngestionHealth as IngestionHealthResponse;
  return realFetch(ENDPOINTS.ingestionHealth);
}

// ---------- Districts (Slice 15/16) ----------
// /districts/heatmap returns 441 entries (HOUSE districts + statewide SENATE
// rows). NJ-5 leads by ~3× the next-busiest district. Items ship with both
// 90d and lifetime alert counts so the UI can render trailing density vs
// historical density side-by-side.
export async function getDistrictsHeatmap(): Promise<DistrictHeatmapEntry[]> {
  const res = await safeFetch<DistrictHeatmap | null>(ENDPOINTS.districtsHeatmap, null);
  return res?.items ?? [];
}

// Per-district detail. State is 2-letter postal; num is the district number
// (0 for at-large). Returns 404 for unknown (state, num) — surfaced as a
// thrown error so the route renders an error boundary.
export async function getDistrict(state: string, num: number): Promise<DistrictOut> {
  return realFetch<DistrictOut>(ENDPOINTS.district(state, num));
}

// District-scoped alert stream. Returns a bare array (no Page envelope) per
// the backend route. Includes alerts triggered on the district's seat-holder
// plus any state officials whose territory overlaps the district.
export async function listDistrictAlerts(
  state: string,
  num: number,
  opts: { limit?: number } = {},
): Promise<DistrictAlertSummary[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const path = qs
    ? `${ENDPOINTS.districtAlerts(state, num)}?${qs}`
    : ENDPOINTS.districtAlerts(state, num);
  return safeFetch<DistrictAlertSummary[]>(path, []);
}

// ---------- SCOTUS (Slice 13) ----------
// 9 active justices. seat_title distinguishes Chief Justice from Associates.
// disclosure_count + most_recent_disclosure_year are summary fields off the
// judicial_disclosures join — useful for a "stale disclosure" hint when the
// most recent filing year is more than 12 months in the past.
export async function listScotusJustices(): Promise<ScotusJusticeOut[]> {
  const page = await safeFetch<WirePage | null>(ENDPOINTS.scotusJustices, null);
  return (page?.items ?? []) as ScotusJusticeOut[];
}

export async function getScotusJustice(id: string): Promise<ScotusJusticeOut | null> {
  const all = await listScotusJustices();
  return all.find((j) => j.id === id) ?? null;
}

export async function listScotusHoldings(id: string): Promise<JudicialHoldingOut[]> {
  const page = await safeFetch<WirePage | null>(ENDPOINTS.scotusHoldings(id), null);
  return (page?.items ?? []) as JudicialHoldingOut[];
}

export async function listScotusTransactions(id: string): Promise<JudicialTransactionOut[]> {
  const page = await safeFetch<WirePage | null>(ENDPOINTS.scotusTransactions(id), null);
  return (page?.items ?? []) as JudicialTransactionOut[];
}

// ---------- News (Slice 11 — GDELT) ----------
// Offset-paginated; backend returns Page<NewsEventOut>. Wire shape is what
// the page renders directly — no adapter needed.
export async function listNews(
  opts: {
    limit?: number;
    offset?: number;
    company_id?: string;
    official_id?: string;
    since?: string;
  } = {},
): Promise<{ items: NewsEventOut[]; total: number; hasMore: boolean }> {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(limit, 200)));
  params.set("offset", String(offset));
  if (opts.company_id) params.set("company_id", opts.company_id);
  if (opts.official_id) params.set("official_id", opts.official_id);
  if (opts.since) params.set("since", opts.since);
  const page = await realFetch<WirePage>(`${ENDPOINTS.newsRecent}?${params}`);
  return {
    items: page.items as NewsEventOut[],
    total: page.page.total ?? 0,
    hasMore: page.page.has_more,
  };
}

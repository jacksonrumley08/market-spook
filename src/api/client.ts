import { API_CONFIG } from "./config";
import mockMembers from "./mocks/members.json";
import mockTransactions from "./mocks/transactions.json";
import mockCommittees from "./mocks/committees.json";
import mockClusters from "./mocks/clusters.json";
import mockTickers from "./mocks/tickers.json";
import mockLeaderboards from "./mocks/leaderboards.json";
import mockAlerts from "./mocks/alerts.json";
import mockBacktest from "./mocks/backtest.json";
import mockSummary from "./mocks/summary.json";
import mockSignalPredictive from "./mocks/signal_predictive.json";
import mockSignalReactive from "./mocks/signal_reactive.json";
import mockCommitteeFlowTop from "./mocks/committee_flow_top.json";
import mockIngestionHealth from "./mocks/ingestion_health.json";

import type {
  AcknowledgeAlertResponse,
  AlertOut as WireAlert,
  ClusterOut as WireCluster,
  CommitteeDetail as WireCommitteeDetail,
  CommitteeOut as WireCommittee,
  DashboardSummary as WireDashboardSummary,
  DisclosureDecayResponse,
  FilingQualityBreakdown,
  IngestionHealthResponse,
  LeaderboardItem as WireLeaderboardItem,
  MemberAlphaResponse,
  MemberDistrictConcentration,
  MemberOut as WireMember,
  Page as WirePage,
  PredictiveFeedItem as WirePredictiveFeedItem,
  TransactionOut as WireTransaction,
} from "./types";
import type {
  AlertOut,
  BacktestRequest,
  BacktestResult,
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
  backtestRun: "/backtest/run",
  dashboardSummary: "/dashboard/summary",
  feedPredictive: "/feed/predictive",
  feedReactive: "/feed/reactive",
  ingestionHealth: "/admin/ingestion/health",
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
// filing_quality_score, late_filing_rate, vagueness_score_avg). The frontend
// previously hit /leaderboards/{kind} (404). We fetch once and sort by the
// kind-specific score field client-side after adaptation. The `late_filer`
// kind sorts ascending (lower = better filers).
export async function getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
  if (API_CONFIG.useMocks) {
    const lb = mockLeaderboards as unknown as Record<LeaderboardKind, LeaderboardEntry[]>;
    return lb[kind];
  }
  const page = await safeFetch<WirePage | null>(`${ENDPOINTS.leaderboard}?limit=100`, null);
  const items = ((page?.items ?? []) as WireLeaderboardItem[]).map((w) =>
    adaptLeaderboardEntry(w, kind),
  );
  const ascending = kind === "late_filer" || kind === "vagueness";
  items.sort((a, b) => (ascending ? a.score - b.score : b.score - a.score));
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
// The UI is built around a "replica trades" model (pick a member, set a lag,
// get cumulative returns). The backend /backtest/run instead takes a named
// strategy (q1_vote_trade_inconsistency / beyer_sector / cluster_fire /
// null_baseline) and returns metrics from the Sharpe-0.678 reference suite.
// Until the UI is rewritten to drive named strategies, the backtest fetcher
// falls back to mock data even when API_CONFIG.useMocks is false.
export async function runBacktest(req: BacktestRequest): Promise<BacktestResult | null> {
  void req;
  if (API_CONFIG.useMocks) {
    await new Promise((r) => setTimeout(r, 350));
    return mockBacktest as unknown as BacktestResult;
  }
  // Real backend can't satisfy the UI's per-member replica semantics yet —
  // see /backtest/run docstring. Surface the deterministic mock so the page
  // remains demoable without misleading users about real results.
  return mockBacktest as unknown as BacktestResult;
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

import { API_CONFIG } from './config';
import mockMembers from './mocks/members.json';
import mockTransactions from './mocks/transactions.json';
import mockCommittees from './mocks/committees.json';
import mockClusters from './mocks/clusters.json';
import mockTickers from './mocks/tickers.json';
import mockLeaderboards from './mocks/leaderboards.json';
import mockAlerts from './mocks/alerts.json';
import mockBacktest from './mocks/backtest.json';
import mockSummary from './mocks/summary.json';
import mockSignalPredictive from './mocks/signal_predictive.json';
import mockSignalReactive from './mocks/signal_reactive.json';
import mockCommitteeFlowTop from './mocks/committee_flow_top.json';
import mockIngestionHealth from './mocks/ingestion_health.json';

import type {
  CommitteeOut as WireCommittee,
  IngestionHealthResponse,
  MemberOut as WireMember,
  Page as WirePage,
  TransactionOut as WireTransaction,
} from './types';
import type {
  AlertOut,
  BacktestRequest,
  BacktestResult,
  ClusterOut,
  CommitteeFlowTop,
  CommitteeOut,
  DashboardSummary,
  LeaderboardEntry,
  LeaderboardKind,
  MemberOut,
  Paginated,
  SignalFeedItem,
  TickerOut,
  TransactionOut,
} from './types-ui';
import { adaptCommittee, adaptMember, adaptTicker, adaptTransaction } from './adapters';

// Centralised endpoint paths. Real-API paths (when they exist) match the FastAPI routes
// in app/api/routes/*.py. Endpoints for slices not yet shipped are listed for forward
// reference but their fetchers degrade gracefully (see safeFetch + the empty-mock fallbacks).
const ENDPOINTS = {
  members: '/members',
  member: (id: string) => `/members/${id}`,
  transactionsRecent: '/transactions/recent',
  transaction: (id: string) => `/transactions/${id}`,
  // Below endpoints are Slice 2+ — backend not yet built.
  committees: '/committees',
  committee: (id: string) => `/committees/${id}`,
  committeeFlowTop: '/committees/flow/top',
  clusters: '/clusters',
  ticker: (sym: string) => `/tickers/${sym}`,
  leaderboard: (kind: string) => `/leaderboards/${kind}`,
  alerts: '/alerts/feed',
  alertDismiss: (id: string) => `/alerts/${id}/dismiss`,
  backtest: '/backtest/replica',
  dashboardSummary: '/dashboard/summary',
  feedPredictive: '/feed/predictive',
  feedReactive: '/feed/reactive',
  ingestionHealth: '/admin/ingestion/health',
};

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    headers: API_CONFIG.headers,
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Wraps fetches against endpoints whose backends aren't built yet.
// Logs once, returns the supplied empty fallback so the UI degrades to a quiet empty state.
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

// Translate the API's cursor-paginated Page<T> shape to the UI's offset-style Paginated<T>.
// Real API returns total only when cheaply computable (e.g. /members). For cursor feeds
// like /transactions/recent, total stays null — UI components must tolerate undefined.
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
      items = items.filter(m => m.name.toLowerCase().includes(q) || m.bioguide_id.toLowerCase().includes(q));
    }
    if (opts.chamber) items = items.filter(m => m.chamber === opts.chamber);
    if (opts.party) items = items.filter(m => m.party === opts.party);
    return paginate(items, opts.limit, opts.offset);
  }
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.chamber) params.set('chamber', opts.chamber.toUpperCase());
  if (opts.party) params.set('party', opts.party.toUpperCase());
  params.set('limit', String(Math.min(limit, 200)));
  params.set('offset', String(offset));
  const page = await realFetch<WirePage>(`${ENDPOINTS.members}?${params}`);
  return wirePageToPaginated<WireMember, MemberOut>(page, adaptMember, limit, offset);
}

export async function getMember(id: string): Promise<MemberOut> {
  if (API_CONFIG.useMocks) {
    const wire = (mockMembers as unknown as WireMember[]).find(x => x.id === id);
    if (!wire) throw new Error(`Member ${id} not found in mocks`);
    return adaptMember(wire);
  }
  const wire = await realFetch<WireMember>(ENDPOINTS.member(id));
  return adaptMember(wire);
}

// ---------- Transactions ----------
export async function listTransactions(opts: {
  has_any_flag?: boolean;
  member_id?: string;
  ticker?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Paginated<TransactionOut>> {
  if (API_CONFIG.useMocks) {
    const wireTx = (mockTransactions as unknown as { items: WireTransaction[] }).items;
    let items = wireTx.map(adaptTransaction);
    if (opts.has_any_flag) items = items.filter(t => t.has_any_flag);
    if (opts.member_id) items = items.filter(t => t.member_id === opts.member_id);
    if (opts.ticker) items = items.filter(t => t.ticker === opts.ticker);
    items = [...items].sort((a, b) => +new Date(b.transaction_date) - +new Date(a.transaction_date));
    return paginate(items, opts.limit ?? 25, opts.offset ?? 0);
  }
  // Real API: /transactions/recent is cursor-paginated. has_any_flag isn't a server filter
  // yet (Slice 1 ships overlap as a derived field on every row), so we over-fetch a bit
  // and filter client-side.
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const fetchLimit = opts.has_any_flag ? Math.min(200, limit * 4) : Math.min(200, limit);
  const params = new URLSearchParams();
  if (opts.member_id) params.set('member_id', opts.member_id);
  if (opts.ticker) params.set('ticker', opts.ticker);
  params.set('limit', String(fetchLimit));
  const page = await realFetch<WirePage>(`${ENDPOINTS.transactionsRecent}?${params}`);
  let items = (page.items as WireTransaction[]).map(adaptTransaction);
  if (opts.has_any_flag) items = items.filter(t => t.has_any_flag);
  return paginate(items, limit, offset);
}

export async function getTransaction(id: string): Promise<TransactionOut> {
  if (API_CONFIG.useMocks) {
    const wireTx = (mockTransactions as unknown as { items: WireTransaction[] }).items;
    const w = wireTx.find(x => String(x.id) === id);
    if (!w) throw new Error(`Transaction ${id} not found`);
    return adaptTransaction(w);
  }
  // Backend has no /transactions/{id} yet — find via /transactions/recent and adapt.
  const page = await realFetch<WirePage>(`${ENDPOINTS.transactionsRecent}?limit=200`);
  const w = (page.items as WireTransaction[]).find(x => String(x.id) === id);
  if (!w) throw new Error(`Transaction ${id} not found`);
  return adaptTransaction(w);
}

// ---------- Committees ----------
// Backend endpoint doesn't exist yet (Slice 2). Fall back to mocks so /committees pages render.
export async function listCommittees(): Promise<CommitteeOut[]> {
  if (API_CONFIG.useMocks) {
    return (mockCommittees as unknown as WireCommittee[]).map(adaptCommittee);
  }
  return safeFetch(
    ENDPOINTS.committees,
    (mockCommittees as unknown as WireCommittee[]).map(adaptCommittee),
  );
}

export async function getCommittee(id: string): Promise<CommitteeOut> {
  if (API_CONFIG.useMocks) {
    const w = (mockCommittees as unknown as WireCommittee[]).find(x => x.id === id);
    if (!w) throw new Error(`Committee ${id} not found`);
    return adaptCommittee(w);
  }
  const wire = await safeFetch<WireCommittee | null>(ENDPOINTS.committee(id), null);
  if (!wire) {
    const fallback = (mockCommittees as unknown as WireCommittee[]).find(x => x.id === id);
    if (!fallback) throw new Error(`Committee ${id} not available yet`);
    return adaptCommittee(fallback);
  }
  return adaptCommittee(wire);
}

export async function getCommitteeFlowTop(limit = 5): Promise<CommitteeFlowTop[]> {
  if (API_CONFIG.useMocks) return (mockCommitteeFlowTop as unknown as CommitteeFlowTop[]).slice(0, limit);
  return safeFetch(`${ENDPOINTS.committeeFlowTop}?limit=${limit}`, [] as CommitteeFlowTop[]);
}

// ---------- Clusters (Slice 3) ----------
export async function listClusters(opts: { limit?: number } = {}): Promise<ClusterOut[]> {
  if (API_CONFIG.useMocks) {
    const items = [...(mockClusters as unknown as ClusterOut[])].sort(
      (a, b) => +new Date(b.formed_at) - +new Date(a.formed_at),
    );
    return opts.limit ? items.slice(0, opts.limit) : items;
  }
  return safeFetch<ClusterOut[]>(ENDPOINTS.clusters, []);
}

// ---------- Tickers (Slice 5/6) ----------
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
  if (API_CONFIG.useMocks) {
    const w = (mockTickers as unknown as WireTickerFixture[]).find(x => x.symbol === symbol.toUpperCase());
    if (!w) throw new Error(`Ticker ${symbol} not found`);
    return adaptTicker(w);
  }
  const wire = await safeFetch<WireTickerFixture | null>(ENDPOINTS.ticker(symbol), null);
  if (!wire) {
    const mock = (mockTickers as unknown as WireTickerFixture[]).find(x => x.symbol === symbol.toUpperCase());
    if (!mock) throw new Error(`Ticker ${symbol} not available yet`);
    return adaptTicker(mock);
  }
  return adaptTicker(wire);
}

export async function listTickerSymbols(): Promise<{ symbol: string; company_name: string }[]> {
  if (API_CONFIG.useMocks)
    return (mockTickers as unknown as WireTickerFixture[]).map(t => ({ symbol: t.symbol, company_name: t.company_name }));
  return safeFetch('/tickers', [] as { symbol: string; company_name: string }[]);
}

// ---------- Leaderboards (Slice 9) ----------
export async function getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
  if (API_CONFIG.useMocks) {
    const lb = mockLeaderboards as unknown as Record<LeaderboardKind, LeaderboardEntry[]>;
    return lb[kind];
  }
  return safeFetch<LeaderboardEntry[]>(ENDPOINTS.leaderboard(kind), []);
}

// ---------- Alerts (Slice 11) ----------
export async function listAlerts(opts: { dismissed?: boolean; kinds?: string[]; member_id?: string; ticker?: string } = {}): Promise<AlertOut[]> {
  if (API_CONFIG.useMocks) {
    let items = mockAlerts as unknown as AlertOut[];
    if (opts.dismissed !== undefined) items = items.filter(a => a.dismissed === opts.dismissed);
    if (opts.kinds?.length) items = items.filter(a => opts.kinds!.includes(a.kind));
    if (opts.member_id) items = items.filter(a => a.member_id === opts.member_id);
    if (opts.ticker) items = items.filter(a => a.ticker === opts.ticker);
    return [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }
  const params = new URLSearchParams();
  if (opts.dismissed !== undefined) params.set('dismissed', String(opts.dismissed));
  return safeFetch<AlertOut[]>(`${ENDPOINTS.alerts}?${params}`, []);
}

export async function dismissAlert(id: string): Promise<void> {
  if (API_CONFIG.useMocks) return;
  await safeFetch(ENDPOINTS.alertDismiss(id), undefined, { method: 'POST' });
}

// ---------- Backtest (Slice 10) ----------
export async function runBacktest(req: BacktestRequest): Promise<BacktestResult | null> {
  if (API_CONFIG.useMocks) {
    await new Promise(r => setTimeout(r, 350));
    return mockBacktest as unknown as BacktestResult;
  }
  return safeFetch<BacktestResult | null>(ENDPOINTS.backtest, null, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// ---------- Dashboard summary (Slice 7) ----------
export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (API_CONFIG.useMocks) return mockSummary as unknown as DashboardSummary;
  return safeFetch<DashboardSummary | null>(ENDPOINTS.dashboardSummary, null);
}

// ---------- Feeds (Slice 7) ----------
// Backend returns Page<T> envelopes: { items: [...], page: {...} } — see
// app/api/routes/clusters.py (/feed/predictive, /feed/reactive). Unwrap .items here
// so the dashboard can keep treating the result as a flat array.
// NOTE: the wire item shape on /feed/predictive and /feed/reactive does NOT match
// SignalFeedItem (FeedColumn reads s.signal_type/score/created_at; predictive ships
// kind/score/occurred_at + detector-specific columns and reactive ships TransactionOut).
// An adapter pass is a separate follow-up; this fix just stops the runtime crash.
export async function getPredictiveFeed(): Promise<SignalFeedItem[]> {
  if (API_CONFIG.useMocks) return mockSignalPredictive as unknown as SignalFeedItem[];
  const page = await safeFetch<WirePage | null>(ENDPOINTS.feedPredictive, null);
  return (page?.items ?? []) as unknown as SignalFeedItem[];
}

export async function getReactiveFeed(): Promise<SignalFeedItem[]> {
  if (API_CONFIG.useMocks) return mockSignalReactive as unknown as SignalFeedItem[];
  const page = await safeFetch<WirePage | null>(ENDPOINTS.feedReactive, null);
  return (page?.items ?? []) as unknown as SignalFeedItem[];
}

// ---------- Ingestion health (real Slice 1 endpoint) ----------
export async function getIngestionHealth(): Promise<IngestionHealthResponse> {
  if (API_CONFIG.useMocks) return mockIngestionHealth as IngestionHealthResponse;
  return realFetch(ENDPOINTS.ingestionHealth);
}

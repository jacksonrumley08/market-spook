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
  Page,
  SignalFeedItem,
  TickerOut,
  TransactionOut,
} from './types';

// Centralised endpoint paths. Integration step swaps mock branches for real fetch().
const ENDPOINTS = {
  members: '/members',
  member: (id: string) => `/members/${id}`,
  transactions: '/transactions',
  transaction: (id: string) => `/transactions/${id}`,
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
};

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    headers: API_CONFIG.headers,
    ...init,
  });
  if (!res.ok) throw new Error(`Failed: ${res.status} ${path}`);
  return res.json();
}

function paginate<T>(items: T[], limit = 25, offset = 0): Page<T> {
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

// ---------- Members ----------
export async function listMembers(opts: { search?: string; chamber?: string; party?: string; limit?: number; offset?: number } = {}): Promise<Page<MemberOut>> {
  if (API_CONFIG.useMocks) {
    let items = mockMembers as unknown as MemberOut[];
    if (opts.search) {
      const q = opts.search.toLowerCase();
      items = items.filter(m => m.name.toLowerCase().includes(q) || m.bioguide_id.toLowerCase().includes(q));
    }
    if (opts.chamber) items = items.filter(m => m.chamber === opts.chamber);
    if (opts.party) items = items.filter(m => m.party === opts.party);
    return paginate(items, opts.limit, opts.offset);
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.members);
}

export async function getMember(id: string): Promise<MemberOut> {
  if (API_CONFIG.useMocks) {
    const m = (mockMembers as unknown as MemberOut[]).find(x => x.id === id || x.bioguide_id === id);
    if (!m) throw new Error(`Member ${id} not found in mocks`);
    return m;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.member(id));
}

// ---------- Transactions ----------
export async function listTransactions(opts: {
  has_any_flag?: boolean;
  member_id?: string;
  ticker?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Page<TransactionOut>> {
  if (API_CONFIG.useMocks) {
    let items = mockTransactions as unknown as TransactionOut[];
    if (opts.has_any_flag) items = items.filter(t => t.has_any_flag);
    if (opts.member_id) items = items.filter(t => t.member_id === opts.member_id);
    if (opts.ticker) items = items.filter(t => t.ticker === opts.ticker);
    items = [...items].sort((a, b) => +new Date(b.transaction_date) - +new Date(a.transaction_date));
    return paginate(items, opts.limit ?? 25, opts.offset ?? 0);
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.transactions);
}

export async function getTransaction(id: string): Promise<TransactionOut> {
  if (API_CONFIG.useMocks) {
    const t = (mockTransactions as unknown as TransactionOut[]).find(x => x.id === id);
    if (!t) throw new Error(`Transaction ${id} not found`);
    return t;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.transaction(id));
}

// ---------- Committees ----------
export async function listCommittees(): Promise<CommitteeOut[]> {
  if (API_CONFIG.useMocks) return mockCommittees as unknown as CommitteeOut[];
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.committees);
}

export async function getCommittee(id: string): Promise<CommitteeOut> {
  if (API_CONFIG.useMocks) {
    const c = (mockCommittees as unknown as CommitteeOut[]).find(x => x.id === id);
    if (!c) throw new Error(`Committee ${id} not found`);
    return c;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.committee(id));
}

export async function getCommitteeFlowTop(limit = 5): Promise<CommitteeFlowTop[]> {
  if (API_CONFIG.useMocks) return (mockCommitteeFlowTop as unknown as CommitteeFlowTop[]).slice(0, limit);
  // TODO: replace with real API call
  return realFetch(`${ENDPOINTS.committeeFlowTop}?limit=${limit}`);
}

// ---------- Clusters ----------
export async function listClusters(opts: { limit?: number } = {}): Promise<ClusterOut[]> {
  if (API_CONFIG.useMocks) {
    const items = [...(mockClusters as unknown as ClusterOut[])].sort(
      (a, b) => +new Date(b.formed_at) - +new Date(a.formed_at),
    );
    return opts.limit ? items.slice(0, opts.limit) : items;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.clusters);
}

// ---------- Tickers ----------
export async function getTicker(symbol: string): Promise<TickerOut> {
  if (API_CONFIG.useMocks) {
    const t = (mockTickers as unknown as TickerOut[]).find(x => x.symbol === symbol.toUpperCase());
    if (!t) throw new Error(`Ticker ${symbol} not found`);
    return t;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.ticker(symbol));
}

export async function listTickerSymbols(): Promise<{ symbol: string; company_name: string }[]> {
  if (API_CONFIG.useMocks)
    return (mockTickers as unknown as TickerOut[]).map(t => ({ symbol: t.symbol, company_name: t.company_name }));
  // TODO: replace with real API call
  return realFetch('/tickers');
}

// ---------- Leaderboards ----------
export async function getLeaderboard(kind: LeaderboardKind): Promise<LeaderboardEntry[]> {
  if (API_CONFIG.useMocks) {
    const lb = mockLeaderboards as unknown as Record<LeaderboardKind, LeaderboardEntry[]>;
    return lb[kind];
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.leaderboard(kind));
}

// ---------- Alerts ----------
export async function listAlerts(opts: { dismissed?: boolean; kinds?: string[]; member_id?: string; ticker?: string } = {}): Promise<AlertOut[]> {
  if (API_CONFIG.useMocks) {
    let items = mockAlerts as unknown as AlertOut[];
    if (opts.dismissed !== undefined) items = items.filter(a => a.dismissed === opts.dismissed);
    if (opts.kinds?.length) items = items.filter(a => opts.kinds!.includes(a.kind));
    if (opts.member_id) items = items.filter(a => a.member_id === opts.member_id);
    if (opts.ticker) items = items.filter(a => a.ticker === opts.ticker);
    return [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }
  // TODO: replace with real API call
  const params = new URLSearchParams();
  if (opts.dismissed !== undefined) params.set('dismissed', String(opts.dismissed));
  return realFetch(`${ENDPOINTS.alerts}?${params}`);
}

export async function dismissAlert(id: string): Promise<void> {
  if (API_CONFIG.useMocks) return;
  // TODO: replace with real API call
  await realFetch(ENDPOINTS.alertDismiss(id), { method: 'POST' });
}

// ---------- Backtest ----------
export async function runBacktest(_req: BacktestRequest): Promise<BacktestResult> {
  if (API_CONFIG.useMocks) {
    await new Promise(r => setTimeout(r, 350));
    return mockBacktest as unknown as BacktestResult;
  }
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.backtest, { method: 'POST', body: JSON.stringify(_req) });
}

// ---------- Dashboard ----------
export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (API_CONFIG.useMocks) return mockSummary as unknown as DashboardSummary;
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.dashboardSummary);
}

// ---------- Feeds ----------
export async function getPredictiveFeed(): Promise<SignalFeedItem[]> {
  if (API_CONFIG.useMocks) return mockSignalPredictive as unknown as SignalFeedItem[];
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.feedPredictive);
}

export async function getReactiveFeed(): Promise<SignalFeedItem[]> {
  if (API_CONFIG.useMocks) return mockSignalReactive as unknown as SignalFeedItem[];
  // TODO: replace with real API call
  return realFetch(ENDPOINTS.feedReactive);
}

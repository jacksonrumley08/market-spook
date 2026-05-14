// Placeholder types — replace with real API types at integration time.

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type OwnerType = 'self' | 'spouse' | 'dependent' | 'joint';
export type TxType = 'buy' | 'sell' | 'exchange' | 'option';
export type Chamber = 'house' | 'senate';
export type Party = 'D' | 'R' | 'I';

export interface MemberOut {
  id: string;
  bioguide_id: string;
  name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  district?: string | null;
  tenure_years: number;
  committees: string[]; // committee ids
  scores: {
    alpha_30d: number;
    alpha_90d: number;
    alpha_180d: number;
    alpha_365d: number;
    hit_rate: number;
    filing_quality: number;
    vagueness_rate: number;
    lateness_score: number;
    options_conviction: number;
  };
  alpha_series: { d: string; v: number }[];
  sector_tilt: { sector: string; weight: number }[];
  hearing_proximity: { proximity_days: number; signed: number; count: number }[];
}

export interface DerivedFlags {
  jurisdiction_overlap?: { committee_id: string; committee_name: string }[];
  hearing_proximity?: { hearing_id: string; topic: string; days_delta: number; date: string };
  contract_proximity?: { contract_id: string; agency: string; award_value: number; days_delta: number };
  lobbying_overlay?: { registrant: string; client: string; topics: string[] };
  vote_trade_consistency?: { bill_id: string; bill_title: string; position: 'yea' | 'nay'; days_delta: number };
  fomc_blackout?: boolean;
  cluster_id?: string;
}

export interface TransactionOut {
  id: string;
  member_id: string;
  member_name: string;
  ticker: string;
  company_name?: string;
  type: TxType;
  amount_min: number;
  amount_max: number;
  owner_type: OwnerType;
  transaction_date: string; // ISO
  filing_date: string; // ISO
  filing_lateness_days: number;
  has_any_flag: boolean;
  flags: DerivedFlags;
  signal_kind?: 'predictive' | 'reactive';
  signal_score?: number;
  alpha_context_30d?: number;
}

export interface CommitteeOut {
  id: string;
  name: string;
  chamber: Chamber;
  jurisdiction_summary: string;
  jurisdiction_sectors: string[];
  member_count: number;
  members: { member_id: string; name: string; party: Party; state: string; alpha_180d: number }[];
  weekly_flow: { sector: string; weeks: { w: string; net: number }[] }[];
  recent_cluster_trades: TransactionOut[];
}

export interface ClusterOut {
  id: string;
  ticker: string;
  company_name: string;
  committee_id: string;
  committee_name: string;
  direction: 'buy' | 'sell';
  window_start: string;
  window_end: string;
  member_count: number;
  members: { member_id: string; name: string; party: Party }[];
  predictive_context: {
    contracts: { contract_id: string; agency: string; award_value: number; date: string }[];
    hearings: { hearing_id: string; topic: string; date: string }[];
    lobbying: { registrant: string; client: string; topics: string[] }[];
  };
  size_series: { d: string; v: number }[];
  formed_at: string;
}

export interface TickerOut {
  symbol: string;
  company_name: string;
  sector: string;
  gics: string;
  ohlc: { d: string; o: number; h: number; l: number; c: number }[];
  congressional_activity: TransactionOut[];
  active_clusters: ClusterOut[];
}

export interface LeaderboardEntry {
  rank: number;
  rank_delta: number;
  member_id: string;
  member_name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  score: number;
  series_30d: { d: string; v: number }[];
}

export type LeaderboardKind =
  | 'alpha'
  | 'hit_rate'
  | 'vagueness'
  | 'late_filer'
  | 'options_conviction'
  | 'filing_quality';

export interface AlertOut {
  id: string;
  kind:
    | 'CLUSTER_THRESHOLD'
    | 'CONTRACT_PROXIMITY'
    | 'FOMC_BLACKOUT'
    | 'WATCHLIST_MATCH'
    | 'NEWS_CATALYST'
    | 'INGESTION_HEALTH';
  severity: 'warning' | 'critical';
  summary: string;
  member_id?: string;
  ticker?: string;
  created_at: string;
  dismissed: boolean;
  payload: Record<string, unknown>;
}

export interface BacktestRequest {
  member_id: string;
  lag_days: number;
  start_date: string;
  end_date: string;
}

export interface BacktestResult {
  cumulative: { d: string; v: number }[];
  total_return: number;
  sharpe: number;
  max_drawdown: number;
  win_rate: number;
  positions: {
    id: string;
    ticker: string;
    entry_date: string;
    exit_date: string;
    side: 'long' | 'short';
    return_pct: number;
  }[];
}

export interface CommitteeFlowTop {
  sector: string;
  net_usd: number;
  series: { d: string; v: number }[];
}

export interface SignalFeedItem {
  id: string;
  kind: 'predictive' | 'reactive';
  signal_type: string;
  member_id: string;
  member_name: string;
  ticker: string;
  score: number;
  created_at: string;
  transaction_id?: string;
}

export interface DashboardSummary {
  active_flagged_count: number;
  active_flagged_series: { d: string; v: number }[];
  active_clusters_count: number;
}

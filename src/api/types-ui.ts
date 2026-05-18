// UI / mock-only types — diverge from the canonical wire schema in `./types.ts`.
// These shapes match the fixtures in `./mocks/*.json` and what the UI renders today.
// Once the live API ships these endpoints (Slice 2+), migrate routes to the canonical
// types and delete this file.

export type Party = "D" | "R" | "I";

export type Chamber = "senate" | "house";

export interface DatedValue {
  d: string;
  v: number;
}

// ---------- Members ----------
export interface MemberScores {
  alpha_30d: number;
  alpha_90d: number;
  alpha_180d: number;
  alpha_365d: number;
  hit_rate: number;
  filing_quality: number;
  vagueness_rate: number;
  lateness_score: number;
  options_conviction: number;
}

export interface SectorTiltSlice {
  sector: string;
  weight: number;
}

export interface HearingProximityBucket {
  proximity_days: number;
  signed: number;
  count: number;
}

export interface MemberOut {
  id: string;
  bioguide_id: string;
  name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  district: number | null;
  tenure_years: number;
  committees: string[];
  scores: MemberScores;
  alpha_series: DatedValue[];
  sector_tilt: SectorTiltSlice[];
  hearing_proximity: HearingProximityBucket[];
}

// ---------- Derived flags ----------
export interface JurisdictionOverlapFlag {
  committee_id: string;
  committee_name: string;
}

export interface HearingProximityFlag {
  hearing_id: string;
  topic: string;
  days_delta: number;
  date: string;
}

export interface ContractProximityFlag {
  contract_id: string;
  agency: string;
  award_value: number;
  days_delta: number;
}

export interface LobbyingOverlayFlag {
  registrant: string;
  client: string;
  topics: string[];
}

export interface VoteTradeConsistencyFlag {
  bill_id: string;
  bill_title: string;
  position: string;
  days_delta: number;
}

export interface DerivedFlags {
  jurisdiction_overlap?: JurisdictionOverlapFlag[];
  hearing_proximity?: HearingProximityFlag;
  contract_proximity?: ContractProximityFlag;
  lobbying_overlay?: LobbyingOverlayFlag;
  vote_trade_consistency?: VoteTradeConsistencyFlag;
  fomc_blackout?: boolean;
  cluster_id?: string;
}

// ---------- Transactions ----------
export type TransactionType = "buy" | "sell" | "option" | "exchange";

export interface TransactionOut {
  id: string;
  member_id: string;
  member_name: string;
  ticker: string;
  company_name?: string | null;
  type: TransactionType;
  amount_min: number;
  amount_max: number;
  owner_type: string;
  transaction_date: string;
  filing_date: string;
  filing_lateness_days: number;
  has_any_flag: boolean;
  flags: DerivedFlags;
  signal_score?: number;
  signal_kind?: string;
  alpha_context_30d?: number;
}

// ---------- Committees ----------
export interface CommitteeMemberSummary {
  member_id: string;
  name: string;
  party: Party;
  state: string;
  alpha_180d: number;
}

export interface CommitteeWeeklyFlowRow {
  sector: string;
  weeks: { w: string; net: number }[];
}

export interface CommitteeOut {
  id: string;
  name: string;
  chamber: Chamber;
  jurisdiction_summary: string;
  jurisdiction_sectors: string[];
  member_count: number;
  members: CommitteeMemberSummary[];
  weekly_flow: CommitteeWeeklyFlowRow[];
  recent_cluster_trades: TransactionOut[];
}

export type CommitteeRole = "CHAIR" | "RANKING" | "MEMBER" | "EX_OFFICIO" | string;

export interface CommitteeOfficial {
  member_id: string;
  bioguide_id: string | null;
  name: string;
  party: Party | null;
  state: string | null;
  role: CommitteeRole;
}

export type HearingStatus = "SCHEDULED" | "HELD" | "POSTPONED" | "CANCELLED" | string;

export interface CommitteeHearing {
  id: string;
  scheduled_at: string;
  topic: string;
  status: HearingStatus;
  location: string | null;
}

export interface CommitteeDetailOut {
  id: string;
  name: string;
  code: string;
  chamber: Chamber;
  members: CommitteeOfficial[];
  recent_hearings: CommitteeHearing[];
}

// ---------- Clusters ----------
export interface ClusterMember {
  member_id: string;
  name: string;
  party: Party;
}

export interface ClusterPredictiveContext {
  contracts: ContractProximityFlag[];
  hearings: { hearing_id: string; topic: string; date: string }[];
  lobbying: LobbyingOverlayFlag[];
}

export interface ClusterOut {
  id: string;
  ticker: string;
  company_name: string;
  committee_id: string;
  committee_name: string;
  direction: "buy" | "sell";
  window_start: string;
  window_end: string;
  member_count: number;
  members: ClusterMember[];
  predictive_context: ClusterPredictiveContext;
  size_series: DatedValue[];
  formed_at: string;
}

// ---------- Tickers ----------
export interface OHLC {
  d: string;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface TickerOut {
  symbol: string;
  company_name: string;
  sector: string;
  gics: string;
  ohlc: OHLC[];
  congressional_activity: TransactionOut[];
  active_clusters: ClusterOut[];
}

// ---------- Leaderboards ----------
export type LeaderboardKind =
  | "alpha"
  | "hit_rate"
  | "vagueness"
  | "late_filer"
  | "options_conviction"
  | "filing_quality";

export interface LeaderboardEntry {
  rank: number;
  rank_delta: number;
  member_id: string;
  member_name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  score: number;
  series_30d: DatedValue[];
}

// ---------- Alerts ----------
// kind and severity are typed as `string` because v1 backend ships an open set
// (see ALERT_KIND_ENUM in src/api/alertKinds.ts for the canonical 15-kind list
// sourced from app/db/types.py:AlertKindEnum). The alerts page renders unknown
// kinds with a neutral chip.
export type AlertKind = string;

export type AlertSeverity = string;

// Lifecycle states from Slice 11. See app/alerts/lifecycle.py.
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "EXPIRED";

export interface AlertOut {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  status: AlertStatus;
  summary: string;
  score_v2: number | null;
  member_id?: string;
  ticker?: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  expiry_at: string | null;
  dismissed: boolean;
  payload: Record<string, unknown>;
}

// ---------- Backtest ----------
export interface BacktestRequest {
  member_id: string;
  lag_days: number;
  start_date: string;
  end_date: string;
}

export interface BacktestPosition {
  id: string;
  ticker: string;
  entry_date: string;
  exit_date: string;
  side: "long" | "short";
  return_pct: number;
}

export interface BacktestResult {
  cumulative: DatedValue[];
  total_return: number;
  sharpe: number;
  max_drawdown: number;
  win_rate: number;
  positions: BacktestPosition[];
}

// ---------- Dashboard ----------
export interface DashboardSummary {
  active_flagged_count: number;
  active_flagged_series: DatedValue[];
  active_clusters_count: number;
}

// ---------- Signal feed ----------
export interface SignalFeedItem {
  id: string;
  kind: "predictive" | "reactive";
  signal_type: string;
  member_id: string;
  member_name: string;
  ticker: string;
  score: number;
  created_at: string;
  transaction_id?: string;
}

// ---------- Committee flow (top sectors) ----------
export interface CommitteeFlowTop {
  sector: string;
  net_usd: number;
  series: DatedValue[];
}

// ---------- Pagination wrapper used by mock endpoints ----------
// `total` is the server count when available (e.g. /members). For cursor /
// has-more feeds (e.g. /alerts) the backend ships null and we surface
// `has_more` so the UI knows whether to render "next page".
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more?: boolean;
}

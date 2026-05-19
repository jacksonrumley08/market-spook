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

export interface MemberCommitteeRef {
  id: string;
  name: string;
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
  committees: MemberCommitteeRef[];
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
  code?: string;
  jurisdiction_summary?: string | null;
  jurisdiction_sectors?: string[];
  member_count: number;
  chair_name?: string | null;
  members?: CommitteeMemberSummary[];
  weekly_flow?: CommitteeWeeklyFlowRow[];
  recent_cluster_trades?: TransactionOut[];
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
// Composite is the load-bearing Slice-9 ranking (0.4·α + 0.3·hit_rate +
// 0.2·filing_q + 0.1·alert_density). The legacy "options_conviction" tab
// silently fell back to composite at the adapter level; we keep the literal
// here so URL search params validate, but the page no longer offers that
// tab to users (see leaderboards.tsx).
export type LeaderboardKind =
  | "composite"
  | "alpha"
  | "hit_rate"
  | "vagueness"
  | "late_filer"
  | "options_conviction"
  | "filing_quality";

export interface LeaderboardEntry {
  // Position in the active-tab sort (1-indexed). Distinct from
  // `rank_overall` which is the backend's composite-score rank and is
  // null for insufficient-sample members.
  rank: number;
  rank_delta: number;
  rank_overall: number | null;
  member_id: string;
  member_name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  // The active tab's score, surfaced by the row's metric column. Kept
  // for backwards compat with sort+format helpers.
  score: number;
  series_30d: DatedValue[];

  // All Slice-9 metrics preserved on every row so per-tab and side-by-side
  // comparison work without re-fetching. See app/api/schemas/leaderboard.py.
  composite_score: number | null;
  alpha_90d: number | null;
  hit_rate_90d: number | null;
  filing_quality_score: number | null;
  late_filing_rate: number | null;
  vagueness_score_avg: number | null;
  n_trades_lifetime: number;
  n_trades_90d: number;
  alert_count_lifetime: number;
  critical_alert_count_lifetime: number;
  // False when n_trades_lifetime < 10. Rows where this is false are still
  // displayed but visually faded with a small-n suffix.
  has_sufficient_sample: boolean;
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
// Wire types live in ./types.ts: BacktestPreset, BacktestRunRequest,
// BacktestRunResponse, BacktestMetricsOut, BacktestTradeOut. No UI-side
// projection is needed — the backend returns shapes the page renders
// directly.

// ---------- Dashboard ----------
export interface DashboardSummary {
  active_flagged_count: number;
  active_flagged_series: DatedValue[];
  active_clusters_count: number;
}

// ---------- Signal feed ----------
// The dashboard's predictive + reactive feeds share a base shape (member,
// ticker, score, timestamp) but the predictive feed carries kind-specific
// detector payloads (vote question, news headline, contract recipient,
// SCOTUS justice, lobbying client, etc.). We model this as a discriminated
// union on `signal_kind` so per-kind row components can narrow safely.
//
// member_name is "Member" placeholder for predictive items where the
// backend ships only an official UUID (Deferral #1 — see audit B1).
// Reactive items always carry the resolved name via TransactionOut.official.

export interface FeedItemBase {
  id: string;
  kind: "predictive" | "reactive";
  // Raw backend kind discriminator (lowercase for predictive feed, uppercase
  // for reactive's overlap flag). Use feedKindLabel / feedKindColor from
  // alertKinds.ts to map to a friendly chip.
  signal_kind: string;
  member_id?: string;
  member_name: string;
  ticker?: string;
  score: number;
  created_at: string;
  transaction_id?: string;
}

// Per-kind detector payloads. Each variant is the union of fields the
// matching detector populates on PredictiveFeedItem in
// app/api/schemas/clusters.py. UI components narrow on `detector.kind`.
export type VoteInconsistencyDetector = {
  kind: "vote_trade_inconsistency";
  vote_question?: string;
  vote_description?: string;
  legis_num?: string;
  member_position?: string;
  trade_direction?: string;
  proximity_days?: number;
  key_vote?: boolean;
  sector_impact?: string;
  company_name?: string;
};

export type NewsProximityDetector = {
  kind: "news_trade_proximity";
  headline?: string;
  source_url?: string;
  tone?: number;
  proximity_days?: number;
  news_event_date?: string;
};

export type StatementContradictionDetector = {
  kind: "statement_trade_contradiction";
  source_url?: string;
  source_type?: string;
  sentiment_score?: number;
  trade_direction?: string;
  proximity_days?: number;
  contradiction_kind?: string;
  gics_sector?: string;
};

export type ScotusOverlapDetector = {
  kind: "scotus_congressional_overlap";
  justice_id?: string;
  member_id?: string;
  justice_trade_direction?: string;
  member_trade_direction?: string;
  proximity_days?: number;
  same_direction?: boolean;
  justice_trade_date?: string;
  member_trade_date?: string;
};

export type FomcBlackoutDetector = {
  kind: "fomc_blackout";
  fed_official_id?: string;
  meeting_id?: string;
};

export type LobbyingOverlayDetector = {
  kind: "lobbying_overlay";
  client_name?: string;
  registrant_name?: string;
  client_company_id?: string;
  issue_codes: string[];
  issue_sector_match?: boolean;
  proximity_days?: number;
  amount_usd?: number;
  aggregated_count?: number;
};

export type ContractProximityDetector = {
  // 'high_value_contract' shares the same detector field family as
  // 'contract_proximity'; we keep them as one variant.
  kind: "contract_proximity" | "high_value_contract";
  recipient_names: string[];
  award_amount?: number;
  award_id?: string;
  proximity_days?: number;
  aggregated_count?: number;
  aggregated_max_amount?: number;
  iso_week?: string;
};

export type ClusterDetector = {
  kind: "cluster";
  ticker?: string;
  committee_name?: string;
  direction?: string;
  member_count?: number;
  window_start?: string;
  window_end?: string;
  member_names: string[];
};

export type HearingProximityDetector = {
  kind: "hearing_proximity";
};

export type StafferProximityDetector = {
  kind: "staffer_trade_proximity";
  overlay_kind?: string;
  matched_sector?: string;
  proximity_days?: number;
  employing_committee_id?: string;
  employing_member_id?: string;
};

export type StateOfficialProximityDetector = {
  kind: "state_official_trade_proximity";
  state?: string;
  office_type?: string;
  overlay_kind?: string;
  proximity_days?: number;
};

// Fallback variant for kinds we haven't built a renderer for yet. Uses a
// sentinel discriminator so the named variants narrow cleanly under switch /
// `d.kind === 'X'`. The original backend kind is preserved as `raw_kind`.
export type UnknownDetector = { kind: "__unknown__"; raw_kind: string };

export type FeedDetector =
  | VoteInconsistencyDetector
  | NewsProximityDetector
  | StatementContradictionDetector
  | ScotusOverlapDetector
  | FomcBlackoutDetector
  | LobbyingOverlayDetector
  | ContractProximityDetector
  | ClusterDetector
  | HearingProximityDetector
  | StafferProximityDetector
  | StateOfficialProximityDetector
  | UnknownDetector;

export interface PredictiveFeedItem extends FeedItemBase {
  kind: "predictive";
  detector: FeedDetector;
}

// Reactive feed = disclosed trades stream. Carries the structured amount,
// direction, hearing proximity, and jurisdiction overlap so the row can
// show "Member bought $1k–$15k near Energy hearing".
export interface ReactiveFeedItem extends FeedItemBase {
  kind: "reactive";
  transaction_type?: string; // BUY | SELL | EXCHANGE | …
  amount_min?: number;
  amount_max?: number;
  amount_bucket?: string;
  jurisdiction_overlap_committees: string[];
  hearing_proximity?: {
    hearing_topic?: string;
    committee_name?: string;
    proximity_days: number;
    scheduled_at?: string;
  };
}

export type SignalFeedItem = PredictiveFeedItem | ReactiveFeedItem;

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

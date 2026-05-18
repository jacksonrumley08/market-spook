// Adapters: canonical wire shape (./types) → UI shape (./types-ui).
// Slice 1 ships sparse fields (party/state/district often null, no scores).
// We synthesize empty defaults so the UI keeps rendering until later slices
// populate the missing data.

import type {
  AlertOut as WireAlert,
  ClusterOut as WireCluster,
  CommitteeOut as WireCommittee,
  LeaderboardItem as WireLeaderboardItem,
  MemberOut as WireMember,
  PredictiveFeedItem as WirePredictiveFeedItem,
  TransactionOut as WireTransaction,
} from './types';
import type {
  AlertOut as UiAlert,
  ClusterOut as UiCluster,
  CommitteeOut as UiCommittee,
  DerivedFlags,
  LeaderboardEntry as UiLeaderboardEntry,
  LeaderboardKind,
  MemberOut as UiMember,
  Party,
  SignalFeedItem,
  TickerOut as UiTicker,
  TransactionOut as UiTransaction,
  Chamber,
} from './types-ui';

// Mocks predate the nested wire schema and ship the overlap as flat fields.
// Real API returns it under TransactionOut.jurisdiction_overlap (see types.ts).
// We accept either so the adapter works against both.
type WireTransactionFixture = WireTransaction & {
  jurisdiction_overlap_flag?: boolean;
  jurisdiction_overlap_committees?: string[];
};

// Wire-fixture extension present on Slice-1 tickers JSON.
type WireTickerFixture = {
  id: string;
  symbol: string;
  exchange: string | null;
  instrument_type: string;
  company_name: string;
  gics_sector: string;
  gics_industry: string;
};

const EMPTY_SCORES = {
  alpha_30d: 0,
  alpha_90d: 0,
  alpha_180d: 0,
  alpha_365d: 0,
  hit_rate: 0,
  filing_quality: 0,
  vagueness_rate: 0,
  lateness_score: 0,
  options_conviction: 0,
};

function chamberToUi(c: string | null | undefined): Chamber {
  return c && c.toUpperCase() === 'SENATE' ? 'senate' : 'house';
}

function partyToUi(p: string | null | undefined): Party {
  if (p === 'D' || p === 'R' || p === 'I') return p;
  return 'I';
}

export function adaptMember(w: WireMember): UiMember {
  return {
    id: w.id,
    bioguide_id: w.bioguide_id ?? '',
    name: w.full_name,
    party: partyToUi(w.party),
    state: w.state ?? '',
    chamber: chamberToUi(w.chamber),
    district: w.district ?? null,
    tenure_years: w.tenure_years ?? 0,
    committees: (w.committees ?? []).map(c => c.committee.id),
    scores: { ...EMPTY_SCORES },
    alpha_series: [],
    sector_tilt: [],
    hearing_proximity: [],
  };
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

function overlapFromWire(w: WireTransactionFixture): { flag: boolean; committees: string[] } {
  // Prefer real-API nested shape; fall back to flat mock fields.
  if (w.jurisdiction_overlap) {
    return {
      flag: !!w.jurisdiction_overlap.flag,
      committees: w.jurisdiction_overlap.committees ?? [],
    };
  }
  return {
    flag: !!w.jurisdiction_overlap_flag,
    committees: w.jurisdiction_overlap_committees ?? [],
  };
}

function buildFlags(w: WireTransactionFixture): DerivedFlags {
  const flags: DerivedFlags = {};
  const { committees } = overlapFromWire(w);
  if (committees.length > 0) {
    flags.jurisdiction_overlap = committees.map(name => ({
      committee_id: name,
      committee_name: name,
    }));
  }
  return flags;
}

export function adaptTransaction(w: WireTransactionFixture): UiTransaction {
  const lateness = w.filed_at ? Math.max(0, daysBetween(w.transaction_date, w.filed_at)) : 0;
  const tType = (w.transaction_type || '').toLowerCase();
  const { flag: overlapFlag } = overlapFromWire(w);
  return {
    id: String(w.id),
    member_id: w.official.id,
    member_name: w.official.full_name,
    ticker: w.ticker?.symbol ?? '—',
    company_name: w.asset_description,
    type: (tType === 'buy' || tType === 'sell' || tType === 'option' || tType === 'exchange'
      ? tType
      : 'buy') as UiTransaction['type'],
    amount_min: Number(w.amount_min_usd ?? 0),
    amount_max: Number(w.amount_max_usd ?? 0),
    owner_type: (w.owner_type ?? '').toLowerCase(),
    transaction_date: w.transaction_date,
    filing_date: w.filed_at ?? w.transaction_date,
    filing_lateness_days: lateness,
    has_any_flag: overlapFlag,
    flags: buildFlags(w),
  };
}

export function adaptCommittee(w: WireCommittee): UiCommittee {
  return {
    id: w.id,
    name: w.name,
    chamber: chamberToUi(w.chamber),
    jurisdiction_summary: 'Jurisdiction details available in later slices.',
    jurisdiction_sectors: [],
    member_count: 0,
    members: [],
    weekly_flow: [],
    recent_cluster_trades: [],
  };
}

export function adaptTicker(w: WireTickerFixture): UiTicker {
  return {
    symbol: w.symbol,
    company_name: w.company_name,
    sector: w.gics_sector,
    gics: w.gics_industry,
    ohlc: [],
    congressional_activity: [],
    active_clusters: [],
  };
}

// ---------- Clusters ----------
export function adaptCluster(w: WireCluster): UiCluster {
  const dir = (w.direction || '').toLowerCase();
  return {
    id: w.id,
    ticker: w.ticker?.symbol ?? '—',
    company_name: w.ticker?.symbol ?? '',
    committee_id: w.committee_id,
    committee_name: w.committee_name,
    direction: dir === 'sell' ? 'sell' : 'buy',
    window_start: w.window_start,
    window_end: w.window_end,
    member_count: w.member_count,
    members: (w.members ?? []).map(m => ({
      member_id: m.official.id,
      name: m.official.full_name,
      party: partyToUi(m.official.party),
    })),
    predictive_context: { contracts: [], hearings: [], lobbying: [] },
    size_series: [],
    formed_at: w.created_at,
  };
}

// ---------- Leaderboards ----------
export function adaptLeaderboardEntry(
  w: WireLeaderboardItem,
  kind: LeaderboardKind,
): UiLeaderboardEntry {
  const kindScore = (() => {
    switch (kind) {
      case 'alpha':
        return w.alpha_90d != null ? Number(w.alpha_90d) : 0;
      case 'hit_rate':
        return w.hit_rate_90d != null ? Number(w.hit_rate_90d) : 0;
      case 'filing_quality':
        return w.filing_quality_score ?? 0;
      case 'late_filer':
        return w.late_filing_rate ?? 0;
      case 'vagueness':
        return w.vagueness_score_avg ?? 0;
      case 'options_conviction':
        // Not directly exposed in LeaderboardItem; fall back to composite.
        return w.composite_score ?? 0;
      default:
        return w.composite_score ?? 0;
    }
  })();
  return {
    rank: w.rank_overall ?? 0,
    rank_delta: 0,
    member_id: w.official_id,
    member_name: w.full_name,
    party: partyToUi(w.party),
    state: w.state ?? '',
    chamber: chamberToUi(w.chamber),
    score: Number(kindScore),
    series_30d: [],
  };
}

// ---------- Alerts ----------
// Canonical kinds — extracted from the alert's payload when present, otherwise
// derived from the alert kind. The UI's "summary" is a short, kind-aware line
// pulled from the same payload.
function alertSummary(kind: string, payload: Record<string, unknown>): string {
  const p = payload as Record<string, unknown>;
  const officialName = (p.official_name ?? p.member_name) as string | undefined;
  const companyName = (p.company_name ?? p.client_name) as string | undefined;
  const symbol = (p.ticker_symbol ?? p.symbol) as string | undefined;
  switch (kind) {
    case 'VOTE_TRADE_INCONSISTENCY':
      return `${officialName ?? 'Member'} traded ${companyName ?? symbol ?? 'a position'} near ${p.legis_num ?? 'a related vote'}`;
    case 'CONTRACT_AWARD_PROXIMITY':
    case 'HIGH_VALUE_CONTRACT':
      return `${officialName ?? 'Member'} traded ${companyName ?? 'a contractor'} near a federal award`;
    case 'LOBBYING_TRADE_OVERLAP':
      return `${officialName ?? 'Member'} traded ${companyName ?? 'a lobbying client'}`;
    case 'CLUSTER_THRESHOLD':
      return `Cluster: ${p.member_count ?? '?'} members on ${symbol ?? p.ticker_symbol ?? 'a ticker'}`;
    case 'FOMC_BLACKOUT':
      return `${officialName ?? 'Fed official'} traded in the FOMC blackout window`;
    case 'NEWS_TRADE_PROXIMITY':
      return `${officialName ?? 'Member'} traded ${companyName ?? 'a company'} near a news event`;
    case 'STATEMENT_TRADE_CONTRADICTION':
      return `${officialName ?? 'Member'} traded against a recent statement`;
    case 'SCOTUS_CONGRESSIONAL_OVERLAP':
      return `Justice + member co-trading ${companyName ?? symbol ?? 'a ticker'}`;
    case 'STAFFER_TRADE_PROXIMITY':
      return `Staffer trade near member's committee jurisdiction`;
    case 'STATE_OFFICIAL_TRADE_PROXIMITY':
      return `State official trade overlap`;
    case 'INGESTION_HEALTH':
      return `Ingestion health: ${p.source_name ?? 'a source'} ${p.event_type ?? 'event'}`;
    default:
      return kind;
  }
}

export function adaptAlert(w: WireAlert): UiAlert {
  const payload = (w.payload ?? {}) as Record<string, unknown>;
  const memberIdRaw = (payload.official_id ?? payload.member_id) as string | undefined;
  const tickerRaw = (payload.ticker_symbol ?? payload.symbol ?? payload.company_name) as string | undefined;
  return {
    id: String(w.id),
    kind: w.kind,
    severity: w.severity,
    summary: alertSummary(w.kind, payload),
    member_id: w.official_id ?? memberIdRaw,
    ticker: tickerRaw,
    created_at: w.created_at,
    dismissed: !!w.dismissed_at || w.status === 'RESOLVED' || w.status === 'EXPIRED',
    payload,
  };
}

// ---------- Feed items ----------
// /feed/predictive — heterogeneous detector items. Each kind populates a
// different subset of detector-prefixed fields; we pick the matching ones to
// produce a uniform SignalFeedItem the dashboard can render.
export function adaptPredictiveFeedItem(w: WirePredictiveFeedItem): SignalFeedItem {
  const k = w.kind;
  // Type-safe lookup against the dynamic detector-prefixed field set.
  const r = w as unknown as Record<string, unknown>;
  const officialId =
    (r.vote_inconsistency_official_id as string | null | undefined) ??
    (r.contract_proximity_official_id as string | null | undefined) ??
    (r.fomc_blackout_official_id as string | null | undefined) ??
    (r.lobbying_overlay_official_id as string | null | undefined) ??
    (r.news_proximity_official_id as string | null | undefined) ??
    (r.statement_contradiction_official_id as string | null | undefined) ??
    (r.scotus_overlap_member_official_id as string | null | undefined) ??
    (r.staffer_proximity_staffer_official_id as string | null | undefined) ??
    (r.state_official_proximity_state_official_id as string | null | undefined) ??
    '';
  const memberName =
    (r.vote_inconsistency_official_name as string | undefined) ??
    (r.contract_proximity_official_name as string | undefined) ??
    (r.lobbying_overlay_official_name as string | undefined) ??
    'Member';
  const ticker =
    (r.vote_inconsistency_company_name as string | undefined) ??
    (r.lobbying_overlay_client_name as string | undefined) ??
    (r.contract_proximity_aggregated_count != null ? `${r.contract_proximity_aggregated_count} contracts` : undefined) ??
    (w.cluster?.ticker?.symbol ?? undefined) ??
    '—';
  const txnId =
    (r.vote_inconsistency_transaction_id as number | null | undefined) ??
    (r.hearing_proximity_transaction_id as number | null | undefined) ??
    (r.fomc_blackout_transaction_id as number | null | undefined) ??
    (r.contract_proximity_transaction_id as number | null | undefined) ??
    (r.lobbying_overlay_transaction_id as number | null | undefined) ??
    (r.news_proximity_transaction_id as number | null | undefined) ??
    (r.statement_contradiction_transaction_id as number | null | undefined) ??
    null;
  return {
    id: `predictive:${k}:${w.occurred_at}:${txnId ?? Math.random().toString(36).slice(2, 8)}`,
    kind: 'predictive',
    signal_type: k,
    member_id: officialId ?? '',
    member_name: memberName,
    ticker,
    score: w.score,
    created_at: w.occurred_at,
    transaction_id: txnId != null ? String(txnId) : undefined,
  };
}

// /feed/reactive — Page<TransactionOut>. Each item is a disclosed trade with
// nested official + ticker; we project it down to SignalFeedItem.
export function adaptReactiveFeedItem(w: WireTransaction): SignalFeedItem {
  const overlap = w.jurisdiction_overlap?.flag ?? false;
  return {
    id: `reactive:${w.id}`,
    kind: 'reactive',
    signal_type: (overlap ? 'jurisdiction_overlap' : (w.transaction_type ?? 'TRADE')),
    member_id: w.official.id,
    member_name: w.official.full_name,
    ticker: w.ticker?.symbol ?? '—',
    score: overlap ? 1 : 0,
    created_at: w.filed_at ?? w.transaction_date,
    transaction_id: String(w.id),
  };
}

// Adapters: canonical wire shape (./types) → UI shape (./types-ui).
// Slice 1 ships sparse fields (party/state/district often null, no scores).
// We synthesize empty defaults so the UI keeps rendering until later slices
// populate the missing data.

import type {
  CommitteeOut as WireCommittee,
  MemberOut as WireMember,
  TransactionOut as WireTransaction,
} from './types';
import type {
  CommitteeOut as UiCommittee,
  DerivedFlags,
  MemberOut as UiMember,
  Party,
  TickerOut as UiTicker,
  TransactionOut as UiTransaction,
  Chamber,
} from './types-ui';

// Wire-fixture extensions present on Slice-1 transactions JSON.
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

function buildFlags(w: WireTransactionFixture): DerivedFlags {
  const flags: DerivedFlags = {};
  const overlaps = w.jurisdiction_overlap_committees ?? [];
  if (overlaps.length > 0) {
    flags.jurisdiction_overlap = overlaps.map(name => ({
      committee_id: name,
      committee_name: name,
    }));
  }
  return flags;
}

export function adaptTransaction(w: WireTransactionFixture): UiTransaction {
  const lateness = w.filed_at ? Math.max(0, daysBetween(w.transaction_date, w.filed_at)) : 0;
  const tType = (w.transaction_type || '').toLowerCase();
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
    has_any_flag: !!w.jurisdiction_overlap_flag,
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

// Adapters: canonical wire shape (./types) → UI shape (./types-ui).
// Slice 1 ships sparse fields (party/state/district often null, no scores).
// We synthesize empty defaults so the UI keeps rendering until later slices
// populate the missing data.

import type {
  AlertOut as WireAlert,
  ClusterOut as WireCluster,
  CommitteeDetail as WireCommitteeDetail,
  CommitteeOut as WireCommittee,
  LeaderboardItem as WireLeaderboardItem,
  MemberOut as WireMember,
  PredictiveFeedItem as WirePredictiveFeedItem,
  TransactionOut as WireTransaction,
} from "./types";
import type {
  AlertOut as UiAlert,
  ClusterOut as UiCluster,
  CommitteeDetailOut as UiCommitteeDetail,
  CommitteeOut as UiCommittee,
  DerivedFlags,
  FeedDetector,
  LeaderboardEntry as UiLeaderboardEntry,
  LeaderboardKind,
  MemberOut as UiMember,
  Party,
  PredictiveFeedItem as UiPredictiveFeedItem,
  ReactiveFeedItem as UiReactiveFeedItem,
  TickerOut as UiTicker,
  TransactionOut as UiTransaction,
  Chamber,
} from "./types-ui";

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
  return c && c.toUpperCase() === "SENATE" ? "senate" : "house";
}

function partyToUi(p: string | null | undefined): Party {
  if (p === "D" || p === "R" || p === "I") return p;
  return "I";
}

export function adaptMember(w: WireMember): UiMember {
  return {
    id: w.id,
    bioguide_id: w.bioguide_id ?? "",
    name: w.full_name,
    party: partyToUi(w.party),
    state: w.state ?? "",
    chamber: chamberToUi(w.chamber),
    district: w.district ?? null,
    tenure_years: w.tenure_years ?? 0,
    committees: (w.committees ?? []).map((c) => ({
      id: c.committee.id,
      name: c.committee.name ?? c.committee.id,
    })),
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
    flags.jurisdiction_overlap = committees.map((name) => ({
      committee_id: name,
      committee_name: name,
    }));
  }
  return flags;
}

export function adaptTransaction(w: WireTransactionFixture): UiTransaction {
  const lateness = w.filed_at ? Math.max(0, daysBetween(w.transaction_date, w.filed_at)) : 0;
  const tType = (w.transaction_type || "").toLowerCase();
  const { flag: overlapFlag } = overlapFromWire(w);
  return {
    id: String(w.id),
    member_id: w.official.id,
    member_name: w.official.full_name,
    ticker: w.ticker?.symbol ?? "—",
    company_name: w.asset_description,
    type: (tType === "buy" || tType === "sell" || tType === "option" || tType === "exchange"
      ? tType
      : "buy") as UiTransaction["type"],
    amount_min: Number(w.amount_min_usd ?? 0),
    amount_max: Number(w.amount_max_usd ?? 0),
    owner_type: (w.owner_type ?? "").toLowerCase(),
    transaction_date: w.transaction_date,
    filing_date: w.filed_at ?? w.transaction_date,
    filing_lateness_days: lateness,
    has_any_flag: overlapFlag,
    flags: buildFlags(w),
  };
}

// Mock-fed directory rows (Slice 1 fixtures); the real backend exposes no
// /committees list endpoint yet, so the index page degrades to this shape.
export function adaptCommittee(w: WireCommittee): UiCommittee {
  return {
    id: w.id,
    name: w.name,
    chamber: chamberToUi(w.chamber),
    jurisdiction_summary: "",
    jurisdiction_sectors: [],
    member_count: 0,
    members: [],
    weekly_flow: [],
    recent_cluster_trades: [],
  };
}

function partyOrNull(p: string | null | undefined): Party | null {
  return p === "D" || p === "R" || p === "I" ? p : null;
}

// /committees/{id} → CommitteeDetail. Surfaces the real members roster and
// recent_hearings; weekly_flow + recent_cluster_trades are not provided by
// this endpoint and are documented as backend gaps on the detail page.
export function adaptCommitteeDetail(w: WireCommitteeDetail): UiCommitteeDetail {
  return {
    id: w.id,
    name: w.name,
    code: w.code,
    chamber: chamberToUi(w.chamber),
    members: (w.members ?? []).map((m) => ({
      member_id: m.id,
      bioguide_id: m.bioguide_id ?? null,
      name: m.full_name,
      party: partyOrNull(m.party),
      state: m.state ?? null,
      role: m.role,
    })),
    recent_hearings: (w.recent_hearings ?? []).map((h) => ({
      id: h.id,
      scheduled_at: h.scheduled_at,
      topic: h.topic,
      status: h.status,
      location: h.location ?? null,
    })),
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
  const dir = (w.direction || "").toLowerCase();
  return {
    id: w.id,
    ticker: w.ticker?.symbol ?? "—",
    company_name: w.ticker?.symbol ?? "",
    committee_id: w.committee_id,
    committee_name: w.committee_name,
    direction: dir === "sell" ? "sell" : "buy",
    window_start: w.window_start,
    window_end: w.window_end,
    member_count: w.member_count,
    members: (w.members ?? []).map((m) => ({
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
// Coerce Decimal-strings ("0.20025…") or numbers to JS number, returning
// null for missing or non-finite values so the UI can render an em-dash.
function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function adaptLeaderboardEntry(
  w: WireLeaderboardItem,
  kind: LeaderboardKind,
): UiLeaderboardEntry {
  const composite_score = numOrNull(w.composite_score);
  const alpha_90d = numOrNull(w.alpha_90d);
  const hit_rate_90d = numOrNull(w.hit_rate_90d);
  const filing_quality_score = numOrNull(w.filing_quality_score);
  const late_filing_rate = numOrNull(w.late_filing_rate);
  const vagueness_score_avg = numOrNull(w.vagueness_score_avg);

  const kindScore = (() => {
    switch (kind) {
      case "composite":
        return composite_score;
      case "alpha":
        return alpha_90d;
      case "hit_rate":
        return hit_rate_90d;
      case "filing_quality":
        return filing_quality_score;
      case "late_filer":
        return late_filing_rate;
      case "vagueness":
        return vagueness_score_avg;
      case "options_conviction":
        // No per-row options_conviction field — kept here for the legacy
        // tab; the page no longer offers it to users.
        return composite_score;
      default:
        return composite_score;
    }
  })();

  return {
    rank: w.rank_overall ?? 0,
    rank_delta: 0,
    rank_overall: w.rank_overall ?? null,
    member_id: w.official_id,
    member_name: w.full_name,
    party: partyToUi(w.party),
    state: w.state ?? "",
    chamber: chamberToUi(w.chamber),
    score: kindScore ?? 0,
    series_30d: [],
    composite_score,
    alpha_90d,
    hit_rate_90d,
    filing_quality_score,
    late_filing_rate,
    vagueness_score_avg,
    n_trades_lifetime: w.n_trades_lifetime,
    n_trades_90d: w.n_trades_90d,
    alert_count_lifetime: w.alert_count_lifetime,
    critical_alert_count_lifetime: w.critical_alert_count_lifetime,
    has_sufficient_sample: w.has_sufficient_sample,
  };
}

// ---------- Alerts ----------
// Build a one-line summary from the alert payload. The previous implementation
// substituted "Member", "a company", "a position" when name fields were absent
// — which happens to be the case for ~100% of NEWS / STATEMENT / SCOTUS alerts
// — and produced rows like "Member traded a company near a news event". This
// version pulls the most informative payload field for each kind and avoids
// English placeholder fallbacks; missing names are signalled by an em-dash
// only on rows where they would otherwise be the sole content.
function alertSummary(kind: string, payload: Record<string, unknown>): string {
  const p = payload as Record<string, unknown>;
  const officialName = (p.official_name ?? p.member_name) as string | undefined;
  const companyName = (p.company_name ?? p.client_name) as string | undefined;
  const symbol = (p.ticker_symbol ?? p.symbol) as string | undefined;
  const subject = officialName ?? "Trade";
  const target = companyName ?? symbol;
  switch (kind) {
    case "VOTE_TRADE_INCONSISTENCY":
      if (p.vote_question) return `Voted on ${p.legis_num ?? "a bill"}: “${p.vote_question}”`;
      return target
        ? `${subject} traded ${target} near a related vote`
        : `${subject} traded near a related vote`;
    case "CONTRACT_AWARD_PROXIMITY":
    case "HIGH_VALUE_CONTRACT": {
      const recipients = Array.isArray(p.recipient_names) ? (p.recipient_names as string[]) : [];
      const who = recipients[0] ?? companyName;
      return who
        ? `${subject} traded ${who} near a federal contract award`
        : `${subject} traded near a federal contract award`;
    }
    case "LOBBYING_TRADE_OVERLAP": {
      const client = p.client_name ?? p.registrant_name;
      return client
        ? `${subject} traded — lobbying overlap with ${client}`
        : `${subject} traded same week as a lobbying filing`;
    }
    case "CLUSTER_THRESHOLD": {
      const ticker = symbol ?? "a ticker";
      const cnt = p.member_count != null ? `${p.member_count} members` : "Multiple members";
      return `${cnt} on ${ticker}${p.committee_name ? ` (${p.committee_name})` : ""}`;
    }
    case "FOMC_BLACKOUT":
      return `${officialName ?? "Fed official"} traded inside the FOMC blackout window`;
    case "NEWS_TRADE_PROXIMITY": {
      const headline = p.headline as string | undefined;
      if (headline) return `News: “${headline.slice(0, 120)}${headline.length > 120 ? "…" : ""}”`;
      const days = p.proximity_days;
      return `${subject} traded ${typeof days === "number" ? `${Math.abs(days)}d ${days >= 0 ? "after" : "before"}` : "near"} a news event`;
    }
    case "STATEMENT_TRADE_CONTRADICTION": {
      const kindRaw = p.contradiction_kind as string | undefined;
      const sector = p.gics_sector as string | undefined;
      if (kindRaw)
        return `Statement clash: ${kindRaw.replace(/_/g, " ")}${sector ? ` · ${sector}` : ""}`;
      return `${subject} traded against a recent public statement`;
    }
    case "SCOTUS_CONGRESSIONAL_OVERLAP": {
      const dir = p.justice_trade_direction as string | undefined;
      const same = p.same_direction as boolean | undefined;
      return target
        ? `Justice + Congress co-trade on ${target}${same ? " (same direction)" : ""}${dir ? ` · justice ${dir.toLowerCase()}` : ""}`
        : `Justice + Congress trade overlap${same ? " (same direction)" : ""}`;
    }
    case "STAFFER_TRADE_PROXIMITY": {
      const overlay = p.overlay_kind as string | undefined;
      const sector = p.matched_sector as string | undefined;
      return overlay
        ? `Senior staffer trade — ${overlay.replace(/_/g, " ").toLowerCase()}${sector ? ` · ${sector}` : ""}`
        : `Senior staffer trade overlaps member's committee`;
    }
    case "STATE_OFFICIAL_TRADE_PROXIMITY": {
      const office = p.office_type as string | undefined;
      const state = p.state as string | undefined;
      const label = office
        ? office
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/^./, (c) => c.toUpperCase())
        : "State official";
      return state
        ? `${label} (${state}) trade overlaps member's jurisdiction`
        : `${label} trade overlap`;
    }
    case "INGESTION_HEALTH": {
      const src = p.source_name ?? p.source;
      const ev = p.event_type ?? "issue";
      return src ? `Data source “${src}” — ${ev}` : `Data source ${ev}`;
    }
    default:
      return kind;
  }
}

export function adaptAlert(w: WireAlert): UiAlert {
  const payload = (w.payload ?? {}) as Record<string, unknown>;
  const memberIdRaw = (payload.official_id ?? payload.member_id) as string | undefined;
  const tickerRaw = (payload.ticker_symbol ?? payload.symbol ?? payload.company_name) as
    | string
    | undefined;
  // score_v2 ships as a Decimal-string (e.g. "89.5414") or null when an alert
  // pre-dates the Slice-11 composite scorer. Coerce to a number for sort/display
  // and preserve null so the UI can flag legacy-unscored rows.
  let score_v2: number | null = null;
  if (w.score_v2 != null) {
    const n = typeof w.score_v2 === "number" ? w.score_v2 : Number(w.score_v2);
    score_v2 = Number.isFinite(n) ? n : null;
  }
  const rawStatus = (w.status ?? "OPEN").toUpperCase();
  const status =
    rawStatus === "OPEN" ||
    rawStatus === "ACKNOWLEDGED" ||
    rawStatus === "RESOLVED" ||
    rawStatus === "EXPIRED"
      ? (rawStatus as UiAlert["status"])
      : "OPEN";
  return {
    id: String(w.id),
    kind: w.kind,
    severity: w.severity,
    status,
    summary: alertSummary(w.kind, payload),
    score_v2,
    member_id: w.official_id ?? memberIdRaw,
    ticker: tickerRaw,
    created_at: w.created_at,
    acknowledged_at: w.acknowledged_at ?? null,
    resolved_at: w.resolved_at ?? null,
    expiry_at: w.expiry_at ?? null,
    dismissed: !!w.dismissed_at || status === "RESOLVED" || status === "EXPIRED",
    payload,
  };
}

// ---------- Feed items ----------
// /feed/predictive ships kind-discriminated detector payloads on a single
// PredictiveFeedItem (wide union: ~80 fields, only the matching detector's
// prefix is populated). The adapter routes the wire item into a kind-tagged
// `detector` object so the row component can narrow safely; the previous
// adapter projected everything down to 6 generic fields and discarded the
// kind-specific payload entirely (audit P1 #1).
function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function buildDetector(w: WirePredictiveFeedItem): FeedDetector {
  const r = w as unknown as Record<string, unknown>;
  switch (w.kind) {
    case "vote_trade_inconsistency":
      return {
        kind: "vote_trade_inconsistency",
        vote_question: str(r.vote_inconsistency_vote_question),
        vote_description: str(r.vote_inconsistency_vote_description),
        legis_num: str(r.vote_inconsistency_legis_num),
        member_position: str(r.vote_inconsistency_member_position),
        trade_direction: str(r.vote_inconsistency_trade_direction),
        proximity_days: num(r.vote_inconsistency_proximity_days),
        key_vote: bool(r.vote_inconsistency_key_vote),
        sector_impact: str(r.vote_inconsistency_sector_impact),
        company_name: str(r.vote_inconsistency_company_name),
      };
    case "news_trade_proximity":
      return {
        kind: "news_trade_proximity",
        headline: str(r.news_proximity_headline),
        source_url: str(r.news_proximity_source_url),
        tone: num(r.news_proximity_tone),
        proximity_days: num(r.news_proximity_proximity_days),
        news_event_date: str(r.news_proximity_news_event_date),
      };
    case "statement_trade_contradiction":
      return {
        kind: "statement_trade_contradiction",
        source_url: str(r.statement_contradiction_statement_source_url),
        source_type: str(r.statement_contradiction_statement_source_type),
        sentiment_score: num(r.statement_contradiction_sentiment_score),
        trade_direction: str(r.statement_contradiction_trade_direction),
        proximity_days: num(r.statement_contradiction_proximity_days),
        contradiction_kind: str(r.statement_contradiction_kind),
        gics_sector: str(r.statement_contradiction_gics_sector),
      };
    case "scotus_congressional_overlap":
      return {
        kind: "scotus_congressional_overlap",
        justice_id: str(r.scotus_overlap_justice_official_id),
        member_id: str(r.scotus_overlap_member_official_id),
        justice_trade_direction: str(r.scotus_overlap_justice_trade_direction),
        member_trade_direction: str(r.scotus_overlap_member_trade_direction),
        proximity_days: num(r.scotus_overlap_proximity_days),
        same_direction: bool(r.scotus_overlap_same_direction),
        justice_trade_date: str(r.scotus_overlap_justice_trade_date),
        member_trade_date: str(r.scotus_overlap_member_trade_date),
      };
    case "fomc_blackout":
      return {
        kind: "fomc_blackout",
        fed_official_id: str(r.fomc_blackout_official_id),
        meeting_id: str(r.fomc_blackout_meeting_id),
      };
    case "lobbying_overlay":
      return {
        kind: "lobbying_overlay",
        client_name: str(r.lobbying_overlay_client_name),
        registrant_name: str(r.lobbying_overlay_registrant_name),
        client_company_id: str(r.lobbying_overlay_client_company_id),
        issue_codes: strArr(r.lobbying_overlay_issue_codes),
        issue_sector_match: bool(r.lobbying_overlay_issue_sector_match),
        proximity_days: num(r.lobbying_overlay_proximity_days),
        amount_usd: num(r.lobbying_overlay_amount_usd),
        aggregated_count: num(r.lobbying_overlay_aggregated_count),
      };
    case "contract_proximity":
    case "high_value_contract":
      return {
        kind: w.kind,
        recipient_names: strArr(r.contract_proximity_recipient_names),
        award_amount: num(r.contract_proximity_award_amount),
        award_id: str(r.contract_proximity_award_id),
        proximity_days: num(r.contract_proximity_proximity_days),
        aggregated_count: num(r.contract_proximity_aggregated_count),
        aggregated_max_amount: num(r.contract_proximity_aggregated_max_amount),
        iso_week: str(r.contract_proximity_iso_week),
      };
    case "cluster": {
      const c = w.cluster;
      return {
        kind: "cluster",
        ticker: c?.ticker?.symbol,
        committee_name: c?.committee_name,
        direction: c?.direction,
        member_count: c?.member_count,
        window_start: c?.window_start,
        window_end: c?.window_end,
        member_names: (c?.members ?? [])
          .map((m) => m.official?.full_name)
          .filter((n): n is string => !!n),
      };
    }
    case "hearing_proximity":
      return { kind: "hearing_proximity" };
    case "staffer_trade_proximity":
      return {
        kind: "staffer_trade_proximity",
        overlay_kind: str(r.staffer_proximity_overlay_kind),
        matched_sector: str(r.staffer_proximity_matched_sector),
        proximity_days: num(r.staffer_proximity_proximity_days),
        employing_committee_id: str(r.staffer_proximity_employing_committee_id),
        employing_member_id: str(r.staffer_proximity_employing_member_id),
      };
    case "state_official_trade_proximity":
      return {
        kind: "state_official_trade_proximity",
        state: str(r.state_official_proximity_state),
        office_type: str(r.state_official_proximity_office_type),
        overlay_kind: str(r.state_official_proximity_overlay_kind),
        proximity_days: num(r.state_official_proximity_proximity_days),
      };
    default:
      return { kind: "__unknown__", raw_kind: w.kind };
  }
}

// Pulls the official UUID from whichever detector-prefixed slot the row uses.
// As of backend PR #26 (Deferral #1 resolved), /feed/predictive resolves the
// trader's name into the top-level `official_name` field server-side via a
// single bulk JOIN against officials. The adapter reads that directly; this
// helper still exists for member_id wiring (linking to /members/{id}).
function predictiveOfficialId(w: WirePredictiveFeedItem): string | undefined {
  const r = w as unknown as Record<string, unknown>;
  return (
    str(r.vote_inconsistency_official_id) ??
    str(r.contract_proximity_official_id) ??
    str(r.fomc_blackout_official_id) ??
    str(r.lobbying_overlay_official_id) ??
    str(r.news_proximity_official_id) ??
    str(r.statement_contradiction_official_id) ??
    str(r.scotus_overlap_member_official_id) ??
    str(r.staffer_proximity_staffer_official_id) ??
    str(r.state_official_proximity_state_official_id)
  );
}

function predictiveTransactionId(w: WirePredictiveFeedItem): string | undefined {
  const r = w as unknown as Record<string, unknown>;
  const id =
    num(r.vote_inconsistency_transaction_id) ??
    num(r.hearing_proximity_transaction_id) ??
    num(r.fomc_blackout_transaction_id) ??
    num(r.contract_proximity_transaction_id) ??
    num(r.lobbying_overlay_transaction_id) ??
    num(r.news_proximity_transaction_id) ??
    num(r.statement_contradiction_transaction_id) ??
    num(r.scotus_overlap_congressional_transaction_id);
  return id != null ? String(id) : undefined;
}

export function adaptPredictiveFeedItem(w: WirePredictiveFeedItem): UiPredictiveFeedItem {
  const detector = buildDetector(w);
  const memberId = predictiveOfficialId(w);
  const txnId = predictiveTransactionId(w);
  // Ticker for top-line display: prefer the detector-resolved company name
  // (vote_trade_inconsistency / lobbying / cluster), else undefined and the
  // row component falls back to a kind-appropriate identifier. Source from
  // the raw record rather than narrowing on `detector` because the union
  // includes UnknownDetector for forward-compat.
  const r = w as unknown as Record<string, unknown>;
  const ticker =
    str(r.vote_inconsistency_company_name) ??
    str(r.lobbying_overlay_client_name) ??
    w.cluster?.ticker?.symbol;
  // Member display name: the backend now resolves the primary trader's name
  // into w.official_name (Deferral #1 / backend PR #26). NULL for cluster
  // items, which carry N members via w.cluster.members instead — fall back
  // to "N members" so the row still renders a meaningful label.
  let memberName = str(w.official_name);
  if (!memberName) {
    if (w.kind === "cluster" && w.cluster?.member_count) {
      memberName = `${w.cluster.member_count} members`;
    } else {
      memberName = "Member"; // legacy fallback (kind we haven't extended yet)
    }
  }
  return {
    id: `predictive:${w.kind}:${w.occurred_at}:${txnId ?? Math.random().toString(36).slice(2, 8)}`,
    kind: "predictive",
    signal_kind: w.kind,
    member_id: memberId,
    member_name: memberName,
    ticker,
    score: w.score,
    created_at: w.occurred_at,
    transaction_id: txnId,
    detector,
  };
}

// /feed/reactive — Page<TransactionOut>. Each item is a disclosed trade
// with nested official + ticker + amount range + hearing proximity. The
// previous adapter projected to {member, ticker, score} and dropped the
// amount + hearing_proximity context (audit P1 #2).
export function adaptReactiveFeedItem(w: WireTransaction): UiReactiveFeedItem {
  const overlap = w.jurisdiction_overlap?.flag ?? false;
  const hp = w.hearing_proximity;
  const aMin = w.amount_min_usd != null ? Number(w.amount_min_usd) : undefined;
  const aMax = w.amount_max_usd != null ? Number(w.amount_max_usd) : undefined;
  return {
    id: `reactive:${w.id}`,
    kind: "reactive",
    signal_kind: overlap ? "JURISDICTION_OVERLAP" : (w.transaction_type ?? "TRADE"),
    member_id: w.official.id,
    member_name: w.official.full_name,
    ticker: w.ticker?.symbol,
    // Use overlap-flag boost so jurisdiction-overlapping trades sort to the
    // top of the reactive feed alongside Slice-3 hearing-proximity hits.
    score: overlap ? 1 : 0,
    created_at: w.filed_at ?? w.transaction_date,
    transaction_id: String(w.id),
    transaction_type: w.transaction_type ?? undefined,
    amount_min: Number.isFinite(aMin) ? aMin : undefined,
    amount_max: Number.isFinite(aMax) ? aMax : undefined,
    amount_bucket: w.amount_bucket ?? undefined,
    jurisdiction_overlap_committees: w.jurisdiction_overlap?.committees ?? [],
    hearing_proximity: hp
      ? {
          hearing_topic: hp.hearing_topic ?? undefined,
          committee_name: hp.committee_name ?? undefined,
          proximity_days: hp.proximity_days,
          scheduled_at: hp.hearing_scheduled_at ?? undefined,
        }
      : undefined,
  };
}

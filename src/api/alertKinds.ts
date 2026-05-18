// Canonical alert-kind list sourced from app/db/types.py:AlertKindEnum
// (backend master). The frontend mirrors all 15 kinds so users can filter
// on every value the backend may emit; some kinds are legacy/Lovable
// pre-slice values that no longer fire (CONTRACT_PROXIMITY, WATCHLIST_MATCH,
// NEWS_CATALYST) but are kept for completeness so historical alerts remain
// reachable.

export const ALERT_KINDS = [
  "VOTE_TRADE_INCONSISTENCY",
  "NEWS_TRADE_PROXIMITY",
  "STATEMENT_TRADE_CONTRADICTION",
  "LOBBYING_TRADE_OVERLAP",
  "CONTRACT_AWARD_PROXIMITY",
  "HIGH_VALUE_CONTRACT",
  "SCOTUS_CONGRESSIONAL_OVERLAP",
  "STAFFER_TRADE_PROXIMITY",
  "STATE_OFFICIAL_TRADE_PROXIMITY",
  "CLUSTER_THRESHOLD",
  "FOMC_BLACKOUT",
  "INGESTION_HEALTH",
  // Legacy kinds — kept in enum, may still appear on historical alerts.
  "CONTRACT_PROXIMITY",
  "WATCHLIST_MATCH",
  "NEWS_CATALYST",
] as const;

export type AlertKindLiteral = (typeof ALERT_KINDS)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "EXPIRED"] as const;
export type AlertStatusLiteral = (typeof ALERT_STATUSES)[number];

// Friendly Title-Case label. Falls back to titlecasing the raw value so
// unknown kinds render readably.
export function alertKindLabel(kind: string): string {
  return kind
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Severity colors used by the pill + row chip. Routes the kind into one of a
// small palette so visually similar detectors group together.
export const KIND_COLOR: Record<string, string> = {
  // Vote / statement / overlap — purple family
  VOTE_TRADE_INCONSISTENCY: "bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30",
  STATEMENT_TRADE_CONTRADICTION:
    "bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30",
  LOBBYING_TRADE_OVERLAP: "bg-[var(--purple)]/15 text-[var(--purple)] ring-[var(--purple)]/30",
  // News-driven — amber
  NEWS_TRADE_PROXIMITY: "bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30",
  NEWS_CATALYST: "bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/30",
  // Contracts — blue
  CONTRACT_AWARD_PROXIMITY: "bg-[var(--blue)]/15 text-[var(--blue)] ring-[var(--blue)]/30",
  HIGH_VALUE_CONTRACT: "bg-[var(--blue)]/15 text-[var(--blue)] ring-[var(--blue)]/30",
  CONTRACT_PROXIMITY: "bg-[var(--blue)]/15 text-[var(--blue)] ring-[var(--blue)]/30",
  // Non-congressional officials — cyan
  SCOTUS_CONGRESSIONAL_OVERLAP: "bg-[var(--cyan)]/15 text-[var(--cyan)] ring-[var(--cyan)]/30",
  STAFFER_TRADE_PROXIMITY: "bg-[var(--cyan)]/15 text-[var(--cyan)] ring-[var(--cyan)]/30",
  STATE_OFFICIAL_TRADE_PROXIMITY: "bg-[var(--cyan)]/15 text-[var(--cyan)] ring-[var(--cyan)]/30",
  // Cluster — distinct
  CLUSTER_THRESHOLD:
    "bg-[var(--cluster-active)]/15 text-[var(--cluster-active)] ring-[var(--cluster-active)]/30",
  // Blackout / watchlist — red
  FOMC_BLACKOUT: "bg-[var(--red)]/15 text-[var(--red)] ring-[var(--red)]/30",
  WATCHLIST_MATCH: "bg-[var(--red)]/15 text-[var(--red)] ring-[var(--red)]/30",
  // Ops
  INGESTION_HEALTH:
    "bg-[var(--text-tertiary)]/15 text-[var(--text-secondary)] ring-[var(--border)]",
};

export function kindColor(kind: string): string {
  return (
    KIND_COLOR[kind] ??
    "bg-[var(--text-tertiary)]/15 text-[var(--text-secondary)] ring-[var(--border)]"
  );
}

// ---------- Predictive feed kinds ----------
// /feed/predictive uses lowercase discriminator strings that do not always
// align 1:1 with AlertKindEnum: 'lobbying_overlay' (feed) corresponds to
// 'LOBBYING_TRADE_OVERLAP' (alerts); 'hearing_proximity' and 'cluster' have
// no alert counterpart. The 12 active feed kinds are the discriminator
// values listed in app/api/schemas/clusters.py:PredictiveFeedItem.kind.
export const PREDICTIVE_FEED_KINDS = [
  "vote_trade_inconsistency",
  "news_trade_proximity",
  "statement_trade_contradiction",
  "scotus_congressional_overlap",
  "fomc_blackout",
  "lobbying_overlay",
  "contract_proximity",
  "high_value_contract",
  "cluster",
  "hearing_proximity",
  "staffer_trade_proximity",
  "state_official_trade_proximity",
] as const;

export type PredictiveFeedKind = (typeof PREDICTIVE_FEED_KINDS)[number];

// Maps any kind string (lowercase feed form, UPPERCASE alert form, or shorthand)
// to the alert-enum canonical key used by KIND_COLOR. Returns the original
// string upper-cased when no mapping exists so unknown kinds get the
// fallback chip color.
const FEED_TO_ALERT_KIND: Record<string, string> = {
  vote_trade_inconsistency: "VOTE_TRADE_INCONSISTENCY",
  news_trade_proximity: "NEWS_TRADE_PROXIMITY",
  statement_trade_contradiction: "STATEMENT_TRADE_CONTRADICTION",
  scotus_congressional_overlap: "SCOTUS_CONGRESSIONAL_OVERLAP",
  fomc_blackout: "FOMC_BLACKOUT",
  lobbying_overlay: "LOBBYING_TRADE_OVERLAP",
  contract_proximity: "CONTRACT_AWARD_PROXIMITY",
  high_value_contract: "HIGH_VALUE_CONTRACT",
  cluster: "CLUSTER_THRESHOLD",
  staffer_trade_proximity: "STAFFER_TRADE_PROXIMITY",
  state_official_trade_proximity: "STATE_OFFICIAL_TRADE_PROXIMITY",
  // hearing_proximity has no alert enum — falls through to a neutral chip.
};

/**
 * Bridge the case + naming drift between the two kind enums the backend
 * ships. This is the permanent client-side normalizer; a backend rewrite to
 * unify the enums was rejected as more invasive than the gain.
 *
 * Drift summary (as of 2026-05-18):
 * - `/feed/predictive` items ship lowercase, sometimes-shortened discriminators
 *   (e.g. `vote_trade_inconsistency`, `cluster`).
 * - `/alerts` rows ship the canonical AlertKindEnum string (uppercase, full,
 *   e.g. `VOTE_TRADE_INCONSISTENCY`, `CLUSTER_THRESHOLD`).
 *
 * The two enums were defined independently in different slices (Slice 3 for
 * the predictive feed, Slice 11 for the alert engine) and the gap predates
 * v1's freeze. FEED_TO_ALERT_KIND maps the asymmetric cases; everything
 * else is a simple toUpperCase().
 */
export function normalizeKind(kind: string): string {
  if (kind in FEED_TO_ALERT_KIND) return FEED_TO_ALERT_KIND[kind];
  return kind.toUpperCase();
}

// Short label used on dashboard feed pills where horizontal space is tight.
// Differs from `alertKindLabel` (which is verbose Title Case) — these are
// chosen so each kind fits in ~14 chars next to a member name + ticker.
const FEED_KIND_SHORT_LABEL: Record<string, string> = {
  vote_trade_inconsistency: "Vote↔Trade",
  news_trade_proximity: "News",
  statement_trade_contradiction: "Statement",
  scotus_congressional_overlap: "SCOTUS",
  fomc_blackout: "FOMC",
  lobbying_overlay: "Lobbying",
  contract_proximity: "Contract",
  high_value_contract: "Hi-$ Contract",
  cluster: "Cluster",
  hearing_proximity: "Hearing",
  staffer_trade_proximity: "Staffer",
  state_official_trade_proximity: "State Official",
};

export function feedKindLabel(kind: string): string {
  if (kind in FEED_KIND_SHORT_LABEL) return FEED_KIND_SHORT_LABEL[kind];
  return alertKindLabel(kind);
}

export function feedKindColor(kind: string): string {
  return kindColor(normalizeKind(kind));
}

// Canonical alert-kind list sourced from app/db/types.py:AlertKindEnum
// (backend master). The frontend mirrors all 15 kinds so a serialized alert
// from any era of the platform renders correctly; ACTIVE_ALERT_KINDS below is
// the subset the filter UI exposes (legacy enums removed so they don't ship as
// dead pill buttons).

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
  // Legacy pre-Slice-3 kinds — no longer fired. Kept in the enum so
  // historical alert rows render without crashing the kind chip.
  "CONTRACT_PROXIMITY",
  "WATCHLIST_MATCH",
  "NEWS_CATALYST",
] as const;

// Filter pills should only show kinds the engine still emits.
export const ACTIVE_ALERT_KINDS = [
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
] as const;

export type AlertKindLiteral = (typeof ALERT_KINDS)[number];

export const ALERT_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "EXPIRED"] as const;
export type AlertStatusLiteral = (typeof ALERT_STATUSES)[number];

// Plain-English label for every kind. The previous implementation merely
// title-cased the enum (`VOTE_TRADE_INCONSISTENCY` → "Vote Trade
// Inconsistency"), which is readable but does not tell the user *what the
// detector found*. These labels do.
const ALERT_KIND_LABEL: Record<string, string> = {
  VOTE_TRADE_INCONSISTENCY: "Voted against own holdings",
  NEWS_TRADE_PROXIMITY: "Traded near major news",
  STATEMENT_TRADE_CONTRADICTION: "Statement contradicts trade",
  LOBBYING_TRADE_OVERLAP: "Lobbying overlaps trade",
  CONTRACT_AWARD_PROXIMITY: "Traded near contract award",
  HIGH_VALUE_CONTRACT: "Large federal contract",
  SCOTUS_CONGRESSIONAL_OVERLAP: "SCOTUS + Congress co-trade",
  STAFFER_TRADE_PROXIMITY: "Staffer traded near event",
  STATE_OFFICIAL_TRADE_PROXIMITY: "State official trade",
  CLUSTER_THRESHOLD: "Coordinated trading detected",
  FOMC_BLACKOUT: "Trade during Fed blackout",
  INGESTION_HEALTH: "Data source failed",
  // Legacy fallbacks — best-effort English.
  CONTRACT_PROXIMITY: "Traded near a contract",
  WATCHLIST_MATCH: "Watchlist match",
  NEWS_CATALYST: "News catalyst",
};

// One-sentence detector description used in tooltips and "what is this?" UI.
export const ALERT_KIND_DESCRIPTION: Record<string, string> = {
  VOTE_TRADE_INCONSISTENCY:
    "Member voted on a bill, then traded a company in the affected sector against the vote direction.",
  NEWS_TRADE_PROXIMITY:
    "Member traded a company shortly before or after a major news event about it.",
  STATEMENT_TRADE_CONTRADICTION:
    "Member made a public statement, then traded in a way that contradicts the position they took.",
  LOBBYING_TRADE_OVERLAP:
    "Member traded a company that was actively lobbying their committee in the same week.",
  CONTRACT_AWARD_PROXIMITY:
    "Member traded a company within days of a federal contract award to that company.",
  HIGH_VALUE_CONTRACT:
    "Member traded a company that recently received an unusually large federal contract.",
  SCOTUS_CONGRESSIONAL_OVERLAP:
    "A Supreme Court justice and a member of Congress traded the same company in overlapping windows.",
  STAFFER_TRADE_PROXIMITY:
    "A senior staffer traded a company whose business overlaps their member's committee or recent hearings.",
  STATE_OFFICIAL_TRADE_PROXIMITY:
    "A state-level official traded a company headquartered in their state or under their jurisdiction.",
  CLUSTER_THRESHOLD:
    "Three or more members of the same committee traded the same company in the same direction within 14 days.",
  FOMC_BLACKOUT:
    "A Federal Reserve official traded during the FOMC blackout period (no-trade window around meetings).",
  INGESTION_HEALTH: "An upstream data source failed enough times to be flagged for ops review.",
  CONTRACT_PROXIMITY: "Legacy alert — superseded by Contract Award Proximity.",
  WATCHLIST_MATCH: "Legacy alert — superseded by per-kind detectors.",
  NEWS_CATALYST: "Legacy alert — superseded by News-Trade Proximity.",
};

// Friendly label lookup. Falls back to a Title-Case rendering for unknown
// kinds so the chip is never blank.
export function alertKindLabel(kind: string): string {
  if (kind in ALERT_KIND_LABEL) return ALERT_KIND_LABEL[kind];
  return kind
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function alertKindDescription(kind: string): string | undefined {
  return ALERT_KIND_DESCRIPTION[kind];
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
// Differs from `alertKindLabel` (which now ships a full-sentence dictionary) —
// these are <= 14 chars so the pill fits next to a member name + ticker.
const FEED_KIND_SHORT_LABEL: Record<string, string> = {
  vote_trade_inconsistency: "Vote conflict",
  news_trade_proximity: "News-trade",
  statement_trade_contradiction: "Statement clash",
  scotus_congressional_overlap: "SCOTUS overlap",
  fomc_blackout: "Fed blackout",
  lobbying_overlay: "Lobby tie",
  contract_proximity: "Contract trade",
  high_value_contract: "Large contract",
  cluster: "Cluster",
  hearing_proximity: "Hearing trade",
  staffer_trade_proximity: "Staffer trade",
  state_official_trade_proximity: "State official",
};

export function feedKindLabel(kind: string): string {
  if (kind in FEED_KIND_SHORT_LABEL) return FEED_KIND_SHORT_LABEL[kind];
  return alertKindLabel(kind);
}

export function feedKindColor(kind: string): string {
  return kindColor(normalizeKind(kind));
}

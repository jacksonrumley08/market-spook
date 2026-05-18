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

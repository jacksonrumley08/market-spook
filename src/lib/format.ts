import numbro from "numbro";

export const fmtUSD = (n: number, opts?: { compact?: boolean }) =>
  opts?.compact
    ? "$" + numbro(n).format({ average: true, totalLength: 3, trimMantissa: true })
    : numbro(n).formatCurrency({ thousandSeparated: true, mantissa: 0 });

export const fmtUSDRange = (a: number, b: number) =>
  `${fmtUSD(a, { compact: true })}–${fmtUSD(b, { compact: true })}`;

export const fmtPct = (n: number, mantissa = 1) =>
  `${n >= 0 ? "+" : ""}${(n * (Math.abs(n) > 1.5 ? 1 : 100)).toFixed(mantissa)}%`;

// Input is already in percent units (e.g. 20.03 for 20.03%). Callers holding
// a decimal must multiply by 100 first — see fmtPctDecimal for that variant.
export const fmtPctRaw = (n: number, mantissa = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(mantissa)}%`;

// Input is a decimal (e.g. 0.2003 for 20.03%). Use this when reading raw
// alpha/hit-rate values straight from the API.
export const fmtPctDecimal = (n: number, mantissa = 1) =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(mantissa)}%`;

export const fmtNum = (n: number) => numbro(n).format({ thousandSeparated: true });

export const signClass = (n: number) =>
  n > 0
    ? "text-[var(--positive)]"
    : n < 0
      ? "text-[var(--negative)]"
      : "text-[var(--text-secondary)]";

// ---------- Enum → human-readable label helpers ----------
//
// Backend ships SCREAMING_SNAKE for most categorical fields. These keep the
// rendering pipeline DRY so we don't title-case in five different places.

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  BUY: "Buy",
  PURCHASE: "Buy",
  SELL: "Sell",
  SALE: "Sell",
  PARTIAL_SALE: "Partial sell",
  EXCHANGE: "Exchange",
  OPTION: "Option",
  OTHER: "Other",
};

export const transactionTypeLabel = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  const key = raw.toUpperCase();
  return TRANSACTION_TYPE_LABEL[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const OWNER_TYPE_LABEL: Record<string, string> = {
  SELF: "Self",
  SP: "Spouse",
  DC: "Dep. child",
  JT: "Joint",
  SP_DC: "Spouse + child",
};

export const ownerTypeLabel = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  return OWNER_TYPE_LABEL[raw.toUpperCase()] ?? raw;
};

const ASSET_CATEGORY_LABEL: Record<string, string> = {
  STOCK: "Stock",
  BOND: "Bond",
  MUTUAL_FUND: "Mutual fund",
  ETF: "ETF",
  OPTION: "Option",
  REAL_ESTATE: "Real estate",
  CASH: "Cash",
  OTHER: "Other",
};

export const assetCategoryLabel = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  const key = raw.toUpperCase();
  return ASSET_CATEGORY_LABEL[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

// Title-case for disclosure-form asset strings ("BNY MELLON US MORTGAGE FUND")
// without mangling preposition/conjunction case. Simple rule: capitalize first
// letter of every word, lowercase the rest, except for known acronyms.
const KEEP_UPPER = new Set(["LLC", "INC", "LP", "ETF", "REIT", "USD", "USA", "US", "UK", "EU"]);

export const titleCaseAsset = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  return raw
    .split(/\s+/)
    .map((word) => {
      const stripped = word.replace(/[^A-Za-z]/g, "");
      if (KEEP_UPPER.has(stripped.toUpperCase()) && stripped.length > 0) return word.toUpperCase();
      if (!/[A-Za-z]/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

// Generic SCREAMING_SNAKE → "Sentence case" helper for one-off enums.
export const sentenceCaseEnum = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  const words = raw.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Humanize backend ingestion-source keys ("house_clerk" → "House Clerk").
// Maintains a small dictionary; falls back to title-casing the underscored
// form so a new source added on the backend still renders readably.
const SOURCE_LABEL: Record<string, string> = {
  house_clerk: "House Clerk PTRs",
  senate_efd: "Senate eFD",
  clerk_house_votes: "House roll-call votes",
  senate_votes: "Senate roll-call votes",
  fomc: "FOMC calendar",
  lda: "LDA lobbying filings",
  usaspending: "USAspending contracts",
  gdelt_events: "GDELT news events",
  alpha_vantage: "Alpha Vantage prices",
  fixthecourt: "FixTheCourt (SCOTUS)",
  congress_gov_hearings: "Congress.gov hearings",
  congress_gov_committees: "Congress.gov committees",
  house_press_releases: "House press releases",
  state_officials: "State officials",
  staffers: "Senior staffers",
  fed_officials: "Federal Reserve officials",
  fed_statements: "Federal Reserve statements",
  member_statements: "Member statements",
};

export const sourceLabel = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  if (SOURCE_LABEL[raw]) return SOURCE_LABEL[raw];
  return raw
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

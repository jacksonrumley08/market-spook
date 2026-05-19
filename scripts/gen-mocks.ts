// Generate mock JSON fixtures for the CongressTrade Intelligence frontend.
// Run: bun run scripts/gen-mocks.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const OUT = "src/api/mocks";
mkdirSync(OUT, { recursive: true });

// Deterministic PRNG so mocks are stable across runs.
let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1));
const id = (p: string) => `${p}_${Math.floor(rand() * 1e9).toString(36)}`;

const NOW = new Date("2026-05-14T12:00:00Z").getTime();
const dayMs = 86400_000;
const isoBack = (d: number) => new Date(NOW - d * dayMs).toISOString();
const dateBack = (d: number) => new Date(NOW - d * dayMs).toISOString().slice(0, 10);

const FIRST = [
  "Sarah",
  "Michael",
  "Jennifer",
  "Robert",
  "Patricia",
  "James",
  "Linda",
  "John",
  "Barbara",
  "David",
  "Susan",
  "Mark",
  "Karen",
  "Steven",
  "Nancy",
  "Daniel",
  "Lisa",
  "Paul",
  "Margaret",
  "Andrew",
  "Betty",
  "Joshua",
  "Sandra",
  "Kenneth",
  "Dorothy",
  "Brian",
  "Nicholas",
  "Helen",
  "Ryan",
  "Donna",
];
const LAST = [
  "Whitfield",
  "Hartman",
  "Caldwell",
  "Pemberton",
  "Sinclair",
  "Beaumont",
  "Ashworth",
  "Rutherford",
  "Kingsley",
  "Holloway",
  "Thornton",
  "Vance",
  "Bellamy",
  "Crawford",
  "Donovan",
  "Eastwood",
  "Fairchild",
  "Galloway",
  "Harrington",
  "Ingram",
  "Jameson",
  "Kensington",
  "Lockhart",
  "Montgomery",
  "Northrop",
  "Osborne",
  "Prescott",
  "Quincy",
  "Radcliffe",
  "Stratton",
];
const STATES = [
  "CA",
  "TX",
  "NY",
  "FL",
  "PA",
  "OH",
  "IL",
  "GA",
  "NC",
  "MI",
  "NJ",
  "VA",
  "WA",
  "AZ",
  "MA",
  "TN",
  "IN",
  "MO",
  "MD",
  "WI",
  "CO",
  "MN",
  "SC",
  "AL",
  "LA",
  "KY",
  "OR",
  "OK",
  "CT",
  "UT",
];

const COMMITTEES = [
  { id: "C001", name: "Senate Banking", chamber: "senate", sectors: ["Financials", "Real Estate"] },
  {
    id: "C002",
    name: "House Energy & Commerce",
    chamber: "house",
    sectors: ["Energy", "Healthcare", "Communication Services"],
  },
  {
    id: "C003",
    name: "Senate Armed Services",
    chamber: "senate",
    sectors: ["Industrials", "Aerospace & Defense", "Information Technology"],
  },
  {
    id: "C004",
    name: "House Ways and Means",
    chamber: "house",
    sectors: ["Financials", "Healthcare", "Consumer Discretionary"],
  },
  {
    id: "C005",
    name: "Senate Intelligence",
    chamber: "senate",
    sectors: ["Information Technology", "Aerospace & Defense", "Communication Services"],
  },
  {
    id: "C006",
    name: "House Financial Services",
    chamber: "house",
    sectors: ["Financials", "Real Estate", "Utilities"],
  },
  {
    id: "C007",
    name: "Senate Health, Education, Labor and Pensions",
    chamber: "senate",
    sectors: ["Healthcare", "Consumer Staples"],
  },
  {
    id: "C008",
    name: "House Judiciary",
    chamber: "house",
    sectors: ["Information Technology", "Communication Services"],
  },
];

const TICKERS = [
  {
    symbol: "NVDA",
    company: "NVIDIA Corporation",
    sector: "Information Technology",
    gics: "Semiconductors",
  },
  {
    symbol: "MSFT",
    company: "Microsoft Corporation",
    sector: "Information Technology",
    gics: "Systems Software",
  },
  {
    symbol: "AAPL",
    company: "Apple Inc.",
    sector: "Information Technology",
    gics: "Tech Hardware",
  },
  { symbol: "LMT", company: "Lockheed Martin", sector: "Industrials", gics: "Aerospace & Defense" },
  { symbol: "RTX", company: "RTX Corporation", sector: "Industrials", gics: "Aerospace & Defense" },
  {
    symbol: "NOC",
    company: "Northrop Grumman",
    sector: "Industrials",
    gics: "Aerospace & Defense",
  },
  { symbol: "JPM", company: "JPMorgan Chase", sector: "Financials", gics: "Diversified Banks" },
  { symbol: "BAC", company: "Bank of America", sector: "Financials", gics: "Diversified Banks" },
  { symbol: "XOM", company: "Exxon Mobil", sector: "Energy", gics: "Integrated Oil & Gas" },
  { symbol: "CVX", company: "Chevron", sector: "Energy", gics: "Integrated Oil & Gas" },
  { symbol: "PFE", company: "Pfizer", sector: "Healthcare", gics: "Pharmaceuticals" },
  {
    symbol: "UNH",
    company: "UnitedHealth Group",
    sector: "Healthcare",
    gics: "Managed Health Care",
  },
  {
    symbol: "TSLA",
    company: "Tesla",
    sector: "Consumer Discretionary",
    gics: "Automobile Manufacturers",
  },
  {
    symbol: "AMZN",
    company: "Amazon.com",
    sector: "Consumer Discretionary",
    gics: "Internet Retail",
  },
  {
    symbol: "GOOGL",
    company: "Alphabet",
    sector: "Communication Services",
    gics: "Interactive Media",
  },
  {
    symbol: "META",
    company: "Meta Platforms",
    sector: "Communication Services",
    gics: "Interactive Media",
  },
  { symbol: "BA", company: "Boeing", sector: "Industrials", gics: "Aerospace & Defense" },
  { symbol: "GE", company: "GE Aerospace", sector: "Industrials", gics: "Aerospace & Defense" },
  {
    symbol: "PLTR",
    company: "Palantir Technologies",
    sector: "Information Technology",
    gics: "Software",
  },
  {
    symbol: "AMD",
    company: "Advanced Micro Devices",
    sector: "Information Technology",
    gics: "Semiconductors",
  },
];

// === Series helpers ===
const series = (n: number, start: number, vol: number) => {
  const out: { d: string; v: number }[] = [];
  let v = start;
  for (let i = n - 1; i >= 0; i--) {
    v += between(-vol, vol);
    out.push({ d: dateBack(i), v: Math.round(v * 1000) / 1000 });
  }
  return out;
};

// === Members ===
const PARTIES: ("D" | "R" | "I")[] = ["D", "R", "R", "D", "D", "R", "I"];
const members = Array.from({ length: 48 }, (_, i) => {
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const chamber: "house" | "senate" = rand() > 0.6 ? "senate" : "house";
  const cmts: string[] = [];
  const ncmt = intBetween(1, 3);
  for (let j = 0; j < ncmt; j++) {
    const c = pick(COMMITTEES);
    if (!cmts.includes(c.id) && c.chamber === chamber) cmts.push(c.id);
  }
  if (cmts.length === 0) cmts.push(COMMITTEES.filter((c) => c.chamber === chamber)[0].id);

  const alpha180 = between(-12, 28);
  return {
    id: `M${String(i + 1).padStart(4, "0")}`,
    bioguide_id: `B${String(intBetween(100000, 999999))}`,
    name,
    party: pick(PARTIES),
    state: pick(STATES),
    chamber,
    district: chamber === "house" ? String(intBetween(1, 30)) : null,
    tenure_years: intBetween(2, 32),
    committees: cmts,
    scores: {
      alpha_30d: between(-8, 18),
      alpha_90d: between(-10, 22),
      alpha_180d: alpha180,
      alpha_365d: between(-12, 32),
      hit_rate: between(0.38, 0.78),
      filing_quality: between(0.45, 0.98),
      vagueness_rate: between(0.05, 0.62),
      lateness_score: between(0, 0.5),
      options_conviction: between(0, 0.85),
    },
    alpha_series: series(180, alpha180 / 2, 0.6),
    sector_tilt: (() => {
      const sectors = [
        "Information Technology",
        "Financials",
        "Healthcare",
        "Industrials",
        "Energy",
        "Consumer Discretionary",
        "Communication Services",
      ];
      const weights = sectors.map(() => rand());
      const total = weights.reduce((a, b) => a + b, 0);
      return sectors
        .map((s, k) => ({ sector: s, weight: weights[k] / total }))
        .sort((a, b) => b.weight - a.weight);
    })(),
    hearing_proximity: [-21, -14, -7, -3, 0, 3, 7, 14, 21].map((p) => ({
      proximity_days: p,
      signed: between(-1, 1),
      count: intBetween(0, 12),
    })),
  };
});

// === Transactions ===
const flagsFor = (memberId: string, ticker: string) => {
  const m = members.find((x) => x.id === memberId)!;
  const f: Record<string, unknown> = {};
  if (rand() > 0.55) {
    f.jurisdiction_overlap = m.committees
      .slice(0, intBetween(1, m.committees.length))
      .map((cid) => {
        const c = COMMITTEES.find((c) => c.id === cid)!;
        return { committee_id: cid, committee_name: c.name };
      });
  }
  if (rand() > 0.7) {
    f.hearing_proximity = {
      hearing_id: id("H"),
      topic: pick([
        "Semiconductor supply chain oversight",
        "AI regulation framework",
        "Defense procurement review",
        "Banking sector stability",
        "Healthcare pricing inquiry",
        "Energy infrastructure resilience",
      ]),
      days_delta: intBetween(-14, 14),
      date: isoBack(intBetween(0, 180)),
    };
  }
  if (rand() > 0.8) {
    f.contract_proximity = {
      contract_id: id("K"),
      agency: pick(["DoD", "DOE", "HHS", "NASA", "GSA"]),
      award_value: intBetween(5_000_000, 5_000_000_000),
      days_delta: intBetween(-21, 21),
    };
  }
  if (rand() > 0.85) {
    f.lobbying_overlay = {
      registrant: pick(["Akin Gump", "Brownstein Hyatt", "Holland & Knight", "BGR Group"]),
      client: ticker,
      topics: [pick(["Tax", "Defense", "Healthcare", "Trade"])],
    };
  }
  if (rand() > 0.85) {
    f.vote_trade_consistency = {
      bill_id: `H.R.${intBetween(100, 9000)}`,
      bill_title: pick([
        "CHIPS Act Reauthorization",
        "Defense Appropriations 2026",
        "Healthcare Modernization Act",
        "Banking Reform Act",
      ]),
      position: rand() > 0.5 ? "yea" : "nay",
      days_delta: intBetween(-30, 30),
    };
  }
  if (rand() > 0.92) f.fomc_blackout = true;
  return f;
};

const OWNER_TYPES = ["self", "spouse", "dependent", "joint"] as const;
const TX_TYPES = ["buy", "sell", "exchange", "option"] as const;
const AMOUNT_BUCKETS: [number, number][] = [
  [1_000, 15_000],
  [15_001, 50_000],
  [50_001, 100_000],
  [100_001, 250_000],
  [250_001, 500_000],
  [500_001, 1_000_000],
  [1_000_001, 5_000_000],
];

const transactions = Array.from({ length: 320 }, (_, i) => {
  const m = pick(members);
  const t = pick(TICKERS);
  const fl = flagsFor(m.id, t.symbol);
  const ttype = pick(TX_TYPES);
  const txDate = intBetween(0, 200);
  const lateness = intBetween(0, 78);
  const bucket = pick(AMOUNT_BUCKETS);
  const hasFlag = Object.keys(fl).length > 0;
  return {
    id: `T${String(i + 1).padStart(5, "0")}`,
    member_id: m.id,
    member_name: m.name,
    ticker: t.symbol,
    company_name: t.company,
    type: ttype,
    amount_min: bucket[0],
    amount_max: bucket[1],
    owner_type: pick(OWNER_TYPES as readonly string[]),
    transaction_date: isoBack(txDate),
    filing_date: isoBack(Math.max(0, txDate - lateness)),
    filing_lateness_days: lateness,
    has_any_flag: hasFlag,
    flags: fl,
    signal_kind: hasFlag && rand() > 0.5 ? (rand() > 0.5 ? "predictive" : "reactive") : undefined,
    signal_score: hasFlag ? Math.round(between(0.3, 0.98) * 100) / 100 : undefined,
    alpha_context_30d: Math.round(between(-12, 28) * 100) / 100,
  };
});

// === Committees ===
const committees = COMMITTEES.map((c) => {
  const memberList = members.filter((m) => m.committees.includes(c.id));
  return {
    id: c.id,
    name: c.name,
    chamber: c.chamber,
    jurisdiction_summary: `Oversight authority across ${c.sectors.join(", ")} with subpoena power and budget review.`,
    jurisdiction_sectors: c.sectors,
    member_count: memberList.length,
    members: memberList
      .map((m) => ({
        member_id: m.id,
        name: m.name,
        party: m.party,
        state: m.state,
        alpha_180d: m.scores.alpha_180d,
      }))
      .sort((a, b) => b.alpha_180d - a.alpha_180d),
    weekly_flow: c.sectors.map((sector) => ({
      sector,
      weeks: Array.from({ length: 26 }, (_, w) => ({
        w: dateBack((25 - w) * 7),
        net: Math.round(between(-50_000_000, 80_000_000)),
      })),
    })),
    recent_cluster_trades: transactions
      .filter((t) =>
        (t.flags.jurisdiction_overlap as { committee_id?: string }[] | undefined)?.some(
          (j) => j.committee_id === c.id,
        ),
      )
      .slice(0, 8),
  };
});

// === Clusters ===
const clusters = Array.from({ length: 14 }, (_, i) => {
  const t = pick(TICKERS);
  const c = pick(COMMITTEES);
  const cMembers = members.filter((m) => m.committees.includes(c.id));
  const sz = intBetween(3, Math.max(4, cMembers.length));
  const memberSlice = cMembers.slice(0, sz);
  const formed = intBetween(1, 60);
  return {
    id: `CL${String(i + 1).padStart(4, "0")}`,
    ticker: t.symbol,
    company_name: t.company,
    committee_id: c.id,
    committee_name: c.name,
    direction: rand() > 0.45 ? "buy" : "sell",
    window_start: isoBack(formed + 14),
    window_end: isoBack(formed),
    member_count: memberSlice.length,
    members: memberSlice.map((m) => ({ member_id: m.id, name: m.name, party: m.party })),
    predictive_context: {
      contracts:
        rand() > 0.55
          ? [
              {
                contract_id: id("K"),
                agency: pick(["DoD", "NASA", "DOE"]),
                award_value: intBetween(50_000_000, 2_500_000_000),
                date: isoBack(intBetween(formed - 7, formed + 7)),
              },
            ]
          : [],
      hearings:
        rand() > 0.4
          ? [
              {
                hearing_id: id("H"),
                topic: pick(["Subcommittee markup", "Oversight session", "Closed briefing"]),
                date: isoBack(intBetween(formed - 7, formed + 7)),
              },
            ]
          : [],
      lobbying:
        rand() > 0.6
          ? [
              {
                registrant: pick(["Akin Gump", "BGR Group", "Holland & Knight"]),
                client: t.symbol,
                topics: ["Defense", "Tax"],
              },
            ]
          : [],
    },
    size_series: series(30, sz / 2, 0.4).map((p) => ({
      d: p.d,
      v: Math.max(1, Math.round(p.v + sz / 2)),
    })),
    formed_at: isoBack(formed),
  };
});

// === Tickers ===
const tickers = TICKERS.map((t) => {
  const ohlc: { d: string; o: number; h: number; l: number; c: number }[] = [];
  let price = between(40, 600);
  for (let i = 364; i >= 0; i--) {
    const o = price;
    const c = o + between(-o * 0.04, o * 0.04);
    const h = Math.max(o, c) + Math.abs(between(0, o * 0.02));
    const l = Math.min(o, c) - Math.abs(between(0, o * 0.02));
    ohlc.push({
      d: dateBack(i),
      o: +o.toFixed(2),
      h: +h.toFixed(2),
      l: +l.toFixed(2),
      c: +c.toFixed(2),
    });
    price = c;
  }
  return {
    symbol: t.symbol,
    company_name: t.company,
    sector: t.sector,
    gics: t.gics,
    ohlc,
    congressional_activity: transactions.filter((x) => x.ticker === t.symbol),
    active_clusters: clusters.filter((c) => c.ticker === t.symbol),
  };
});

// === Leaderboards ===
const lbBuilder = (scoreOf: (m: (typeof members)[number]) => number, asc = false) => {
  const sorted = [...members]
    .map((m) => ({ m, s: scoreOf(m) }))
    .sort((a, b) => (asc ? a.s - b.s : b.s - a.s));
  return sorted.map((row, i) => ({
    rank: i + 1,
    rank_delta: intBetween(-5, 5),
    member_id: row.m.id,
    member_name: row.m.name,
    party: row.m.party,
    state: row.m.state,
    chamber: row.m.chamber,
    score: Math.round(row.s * 1000) / 1000,
    series_30d: series(30, row.s / 2, 0.4),
  }));
};
const leaderboards = {
  alpha: lbBuilder((m) => m.scores.alpha_180d),
  hit_rate: lbBuilder((m) => m.scores.hit_rate),
  vagueness: lbBuilder((m) => m.scores.vagueness_rate),
  late_filer: lbBuilder((m) => m.scores.lateness_score),
  options_conviction: lbBuilder((m) => m.scores.options_conviction),
  filing_quality: lbBuilder((m) => m.scores.filing_quality, true),
};

// === Alerts ===
const ALERT_KINDS = [
  "CLUSTER_THRESHOLD",
  "CONTRACT_PROXIMITY",
  "FOMC_BLACKOUT",
  "WATCHLIST_MATCH",
  "NEWS_CATALYST",
  "INGESTION_HEALTH",
] as const;
const alerts = Array.from({ length: 64 }, (_, i) => {
  const kind = pick(ALERT_KINDS as readonly (typeof ALERT_KINDS)[number][]);
  const m = pick(members);
  const t = pick(TICKERS);
  const summaryByKind: Record<string, string> = {
    CLUSTER_THRESHOLD: `${intBetween(4, 11)} members of ${pick(COMMITTEES).name} bought ${t.symbol} within 14 days`,
    CONTRACT_PROXIMITY: `${m.name} purchased ${t.symbol} ${intBetween(1, 9)} days before $${intBetween(50, 900)}M ${pick(["DoD", "NASA", "DOE"])} award`,
    FOMC_BLACKOUT: `${m.name} executed ${t.symbol} trade during FOMC blackout window`,
    WATCHLIST_MATCH: `Watchlist hit: ${m.name} bought ${t.symbol}`,
    NEWS_CATALYST: `${t.symbol} mentioned in 14 news headlines within 72h of ${m.name} trade`,
    INGESTION_HEALTH: `STOCK Act feed lag exceeded threshold (${intBetween(2, 18)}h)`,
  };
  return {
    id: `A${String(i + 1).padStart(5, "0")}`,
    kind,
    severity: rand() > 0.7 ? "critical" : "warning",
    summary: summaryByKind[kind],
    member_id: kind === "INGESTION_HEALTH" ? undefined : m.id,
    ticker: kind === "INGESTION_HEALTH" ? undefined : t.symbol,
    created_at: isoBack(rand() * 30),
    dismissed: rand() > 0.78,
    payload: {
      kind,
      member_id: m.id,
      ticker: t.symbol,
      window_days: intBetween(3, 21),
      score: Math.round(between(0.4, 0.99) * 100) / 100,
      detail: "See linked transaction(s) for full chain of evidence.",
    },
  };
});

// === Backtest (single canned result) ===
const backtest = (() => {
  let v = 100;
  const cum = Array.from({ length: 365 }, (_, i) => {
    v *= 1 + between(-0.018, 0.022);
    return { d: dateBack(364 - i), v: Math.round(v * 100) / 100 };
  });
  return {
    cumulative: cum,
    total_return: +(cum[cum.length - 1].v / 100 - 1).toFixed(4),
    sharpe: +between(0.6, 2.4).toFixed(2),
    max_drawdown: +(-between(0.05, 0.28)).toFixed(4),
    win_rate: +between(0.46, 0.68).toFixed(3),
    positions: Array.from({ length: 28 }, (_, i) => {
      const t = pick(TICKERS);
      const entry = intBetween(20, 360);
      const exit = Math.max(1, entry - intBetween(3, 60));
      return {
        id: `P${i + 1}`,
        ticker: t.symbol,
        entry_date: isoBack(entry),
        exit_date: isoBack(exit),
        side: rand() > 0.25 ? "long" : "short",
        return_pct: +between(-0.18, 0.34).toFixed(4),
      };
    }),
  };
})();

// === Dashboard summary + signal feeds + committee flow top ===
const summary = {
  active_flagged_count: transactions.filter((t) => t.has_any_flag).length,
  active_flagged_series: series(30, 8, 1.5).map((p) => ({
    d: p.d,
    v: Math.max(0, Math.round(p.v + 9)),
  })),
  active_clusters_count: clusters.length,
};

const signal_predictive = transactions
  .filter((t) => t.signal_kind === "predictive")
  .slice(0, 80)
  .map((t, i) => ({
    id: `SP${i + 1}`,
    kind: "predictive" as const,
    signal_type: pick([
      "CONTRACT_LEAD",
      "CLUSTER_FORMATION",
      "LOBBYING_OVERLAY",
      "HEARING_PRELUDE",
    ]),
    member_id: t.member_id,
    member_name: t.member_name,
    ticker: t.ticker,
    score: t.signal_score ?? 0.5,
    created_at: t.transaction_date,
    transaction_id: t.id,
  }));

const signal_reactive = transactions
  .filter((t) => t.signal_kind === "reactive")
  .slice(0, 80)
  .map((t, i) => ({
    id: `SR${i + 1}`,
    kind: "reactive" as const,
    signal_type: pick([
      "POST_HEARING_TRADE",
      "POST_VOTE_TRADE",
      "NEWS_REACTION",
      "BLACKOUT_VIOLATION",
    ]),
    member_id: t.member_id,
    member_name: t.member_name,
    ticker: t.ticker,
    score: t.signal_score ?? 0.5,
    created_at: t.transaction_date,
    transaction_id: t.id,
  }));

const committee_flow_top = [
  "Aerospace & Defense",
  "Semiconductors",
  "Pharmaceuticals",
  "Diversified Banks",
  "Integrated Oil & Gas",
]
  .map((sector) => ({
    sector,
    net_usd: Math.round(between(-50_000_000, 220_000_000)),
    series: series(7, 0, 4).map((p) => ({ d: p.d, v: Math.round(p.v * 1_000_000) })),
  }))
  .sort((a, b) => b.net_usd - a.net_usd);

// === Write ===
const write = (name: string, data: unknown) => {
  const path = join(OUT, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`wrote ${path}`);
};

write("members.json", members);
write("transactions.json", transactions);
write("committees.json", committees);
write("clusters.json", clusters);
write("tickers.json", tickers);
write("leaderboards.json", leaderboards);
write("alerts.json", alerts);
write("backtest.json", backtest);
write("summary.json", summary);
write("signal_predictive.json", signal_predictive);
write("signal_reactive.json", signal_reactive);
write("committee_flow_top.json", committee_flow_top);
console.log("done");

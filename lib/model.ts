// Copy Radar: a token launch radar that reads pre-token protocols as positions
// the crowd has already taken, and scores them as copy-trading signals.
//
// The crowd's committed capital is the protocol's TVL. The flow of new capital
// is its seven-day TVL change. The accumulation window is how long it has run
// with no token recorded. The spread of the crowd is how many chains it sits on.
// One function turns those four snapshot figures into an implied value and a
// mirror signal. No protocol name is ever special-cased: every row is scored by
// the same function, and the dashboard's signal tuner re-runs that function live.
//
// Implied value, for one protocol:
//
//   base        = tvl_usd x BASE_MULTIPLE
//   flow        = clamp(change_7d, -50, 150) per cent
//   flowMult    = 1 + (flow / 100) x FLOW_WEIGHT
//   tenure      = 0.5 + min(age_days, 1460) / 1460 x 0.5   (age unknown: 180 days)
//   breadth     = 1 + min(chains, 10) x 0.02
//   implied     = max(1, round(base x flowMult x tenureMult x breadthMult))
//
// Copy score, 0 to 100, weights the same four factors on comparable scales:
//
//   tvlScore    = log-scale of TVL against the board's largest TVL
//   flowScore   = (clamped flow + 30) / 90, flow clamped to -30..+60 for the score:
//                 most seven-day changes fall in that band, so the score reads
//                 momentum instead of compressing it into the value clamp's tail
//   tenureScore = min(age_days, 1460) / 1460
//   breadthScore= min(chains, 10) / 10
//   score       = round(100 x (0.45 x tvl + 0.30 x flow + 0.15 x tenure + 0.10 x breadth))
//
// Signal bands from the score: 65+ STRONG MIRROR, 45+ MIRROR, 25+ WATCH, else
// TRACK. Each band names the allocation the farm plan sizes its position with.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the tuner moves them. */
export interface ModelConstants {
  base_multiple: number;
  flow_weight: number;
  flow_floor: number;
  flow_cap: number;
  tenure_floor: number;
  tenure_range: number;
  tenure_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  weight_tvl: number;
  weight_flow: number;
  weight_tenure: number;
  weight_breadth: number;
  score_flow_floor: number;
  score_flow_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  flow_weight: 0.6,
  flow_floor: -50,
  flow_cap: 150,
  tenure_floor: 0.5,
  tenure_range: 0.5,
  tenure_days: 1460,
  unknown_age_days: 180,
  breadth_per_chain: 0.02,
  breadth_max_chains: 10,
  weight_tvl: 0.45,
  weight_flow: 0.3,
  weight_tenure: 0.15,
  weight_breadth: 0.1,
  score_flow_floor: -30,
  score_flow_cap: 60,
};

/** The model's version label: the dashboard names it and the page quotes it. */
export const MODEL_VERSION = 'copy-radar-1';

/** The four mirror signals, strongest first. */
export const SIGNALS = ['STRONG MIRROR', 'MIRROR', 'WATCH', 'TRACK'] as const;
export type Signal = (typeof SIGNALS)[number];

/** The allocation, in US dollars, each signal sizes its farm position with. */
export const ALLOCATION: Record<Signal, number> = {
  'STRONG MIRROR': 250,
  MIRROR: 150,
  WATCH: 100,
  TRACK: 50,
};

/** The score a signal starts at. */
export const SIGNAL_FLOOR: Record<Signal, number> = {
  'STRONG MIRROR': 65,
  MIRROR: 45,
  WATCH: 25,
  TRACK: 0,
};

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The four factors behind one protocol's signal, for the detail view. */
export interface SignalFactors {
  flow_pct: number;
  flow_multiplier: number;
  tenure_multiplier: number;
  breadth_multiplier: number;
  age_days: number | null;
  tvl_score: number;
  flow_score: number;
  tenure_score: number;
  breadth_score: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  signal: Signal;
  copy_score: number;
  allocation_usd: number;
  factors: SignalFactors;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with its farm plan and factor scores. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  signal: Signal;
  copy_score: number;
  allocation_usd: number;
  flow_multiplier: number;
  tenure_multiplier: number;
  breadth_multiplier: number;
  factors: { tvl: number; flow: number; tenure: number; breadth: number };
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The signal band a copy score falls in. */
export function signalFor(score: number): Signal {
  if (score >= SIGNAL_FLOOR['STRONG MIRROR']) return 'STRONG MIRROR';
  if (score >= SIGNAL_FLOOR.MIRROR) return 'MIRROR';
  if (score >= SIGNAL_FLOOR.WATCH) return 'WATCH';
  return 'TRACK';
}

/** The four factors and the implied value one protocol gets under `model`. */
export function copySignal(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  maxTvl: number,
): { implied: number; score: number; signal: Signal; factors: SignalFactors } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawFlow = finite(protocol.change_7d, 0);
  const flowPct = Math.min(model.flow_cap, Math.max(model.flow_floor, rawFlow));
  const flowMult = 1 + (flowPct / 100) * model.flow_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const tenureMult =
    model.tenure_floor +
    (Math.min(Math.max(ageForModel, 0), model.tenure_days) / model.tenure_days) * model.tenure_range;
  const breadthMult =
    1 + Math.min(protocol.chains.length, model.breadth_max_chains) * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * model.base_multiple * flowMult * tenureMult * breadthMult));

  const floorLog = Math.log10(5_000_000);
  const topLog = Math.log10(Math.max(maxTvl, 5_000_001));
  const tvlScore = Math.min(1, Math.max(0, (Math.log10(Math.max(protocol.tvl_usd, 1)) - floorLog) / (topLog - floorLog)));
  const scoreFlow = Math.min(model.score_flow_cap, Math.max(model.score_flow_floor, rawFlow));
  const flowScore = Math.min(1, Math.max(0, (scoreFlow - model.score_flow_floor) / (model.score_flow_cap - model.score_flow_floor)));
  const tenureScore = Math.min(1, Math.max(0, ageForModel / model.tenure_days));
  const breadthScore = Math.min(1, Math.max(0, Math.min(protocol.chains.length, model.breadth_max_chains) / model.breadth_max_chains));
  const score = Math.round(
    100 *
      (model.weight_tvl * tvlScore +
        model.weight_flow * flowScore +
        model.weight_tenure * tenureScore +
        model.weight_breadth * breadthScore),
  );
  return {
    implied,
    score,
    signal: signalFor(score),
    factors: {
      flow_pct: flowPct,
      flow_multiplier: round4(flowMult),
      tenure_multiplier: round4(tenureMult),
      breadth_multiplier: round4(breadthMult),
      age_days: age,
      tvl_score: round4(tvlScore),
      flow_score: round4(flowScore),
      tenure_score: round4(tenureScore),
      breadth_score: round4(breadthScore),
    },
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the house's watchlist rule reads as a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A whole word wrapped, staked or staking in a name: a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the start of a protocol's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not
 * a versioned pool, and not a wrapped, staked or bridged product of a token
 * that already trades — the watchlist rule's exclusions, applied to the early
 * radar too. The watchlist itself is added regardless: the rule built it.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, below the floor or
  // left off the list. A chosen protocol stays chosen; nothing is capped by TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const maxTvl = Math.max(...[...chosen.values()].map((p) => p.tvl_usd), 1);
  const scored = [...chosen.values()].map((p) => {
    const { implied, score, signal, factors } = copySignal(p, snapshot.as_of, model, maxTvl);
    return { p, implied, score, signal, factors };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.factors.age_days,
    implied_value_usd: s.implied,
    signal: s.signal,
    copy_score: s.score,
    allocation_usd: ALLOCATION[s.signal],
    factors: s.factors,
    farm_steps: farmSteps(s.p, s.signal, ALLOCATION[s.signal], s.factors.age_days).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's mirror action, in the words a copier can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Mirror the lenders: lend $${capital} of USDC on ${name} on ${chain} and leave the loan open.`;
  if (c.includes('dex')) return `Mirror the liquidity providers: seed $${capital} into ${name}'s deepest pool on ${chain} and leave it in.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Mirror the yield chasers: deposit $${capital} of USDC into a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('bridge') || c.includes('canonical bridge')) return `Mirror the bridgers: bridge $${capital} of USDC to ${chain} through ${name} and put the bridged funds to work in its app.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking') || c.includes('restaked') || c.includes('staking')) return `Mirror the stakers: stake $${capital} of the chain's staking asset through ${name} and hold the receipt token.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) return `Mirror the traders: post $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Mirror the predictors: fund $${capital} and take one position on a ${name} market.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Mirror the allocators: allocate $${capital} to a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mirror the stablecoin holders: mint or hold $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mirror the real-world holders: mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Mirror the insured: buy $${capital} of cover from ${name} on ${chain} and keep the policy live.`;
  if (c.includes('synthetic')) return `Mirror the minters: mint $${capital} of the synthetic asset on ${name} on ${chain} and hold it.`;
  if (c.includes('leveraged farm')) return `Mirror the leveraged farmers: open a $${capital} leveraged position on ${name} on ${chain} and watch the health factor.`;
  return `Mirror the depositors: deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's copy-trading farm plan: six steps, each an action with a cost and
 * a time. The plan is derived from the protocol's own record (category, chains,
 * TVL, age) and its signal's allocation, never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, signal: Signal, capital: number, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Open a fresh mirror wallet that holds only the funds you plan to copy with, and keep its seed phrase offline on paper.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Copy the crowd once a week: repeat one qualifying action, a deposit, a borrow, a swap or a vote, so the wallet stays active.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the mirror position for at least ${hold} days so the activity is counted in more than one snapshot, and do not close it early.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Each week, re-check this protocol's signal on the radar: when it falls a band, trim the position by half; when it rises a band, add $${Math.round(capital / 2)}.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, never from a link someone sends you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js: the page renders the same farm plan board.json holds. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    signal: row.signal,
    copy_score: row.copy_score,
    allocation_usd: row.allocation_usd,
    flow_multiplier: row.factors.flow_multiplier,
    tenure_multiplier: row.factors.tenure_multiplier,
    breadth_multiplier: row.factors.breadth_multiplier,
    factors: {
      tvl: row.factors.tvl_score,
      flow: row.factors.flow_score,
      tenure: row.factors.tenure_score,
      breadth: row.factors.breadth_score,
    },
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/**
 * "More for less" — given where a family lives now, what they pay, and where
 * they work, find neighborhoods ACROSS all cities where a home of the same size
 * costs less, within a commute limit, and say what they gain or give up.
 *
 * Pure logic (no fs / network) so it is unit-tested; the server index lives in
 * lib/crossCity.ts and drive times come from app/api/alternatives.
 */
import { marketPrice, type Deal, type RoomKey, type SizePrices } from "./market";

/** One neighborhood in the cross-city index. Null = no data for that measure. */
export type IndexNeighborhood = {
  id: string;
  he: string;
  cityId: string;
  citySlug: string;
  cityHe: string;
  center: [number, number];
  rent: SizePrices;
  buy: SizePrices;
  /** GreenScore 0–100. */
  green: number | null;
  /** Mean Meitzav score of schools within walking distance. */
  schools: number | null;
  /** Safety score 0–100 (higher = safer). */
  safety: number | null;
  /** Quiet score 0–100 (distance from major roads / rail / industry). */
  quiet: number | null;
  /** % of residents aged 0–19 — how much of a "families with kids" place it is. */
  kids: number | null;
};

/** The measures a family can choose to compare on. Price is always compared. */
export const METRICS = {
  schools: { label: "בתי ספר", unit: "נק׳ מיצ״ב", tolerance: 12, per: 4, cap: 8, noise: 3 },
  green: { label: "ירוק ופארקים", unit: "נק׳", tolerance: 10, per: 6, cap: 6, noise: 2 },
  safety: { label: "בטיחות", unit: "נק׳", tolerance: 10, per: 8, cap: 5, noise: 2 },
  quiet: { label: "שקט", unit: "נק׳", tolerance: 10, per: 8, cap: 5, noise: 2 },
  kids: { label: "משפחות עם ילדים", unit: "נק׳ אחוז", tolerance: 4, per: 1.5, cap: 5, noise: 1 },
} as const;
export type MetricId = keyof typeof METRICS;
export const METRIC_IDS = Object.keys(METRICS) as MetricId[];
export const DEFAULT_METRICS: MetricId[] = ["schools", "green", "safety"];

export type Alternative = {
  nb: IndexNeighborhood;
  price: number;
  /** Home price minus this one — always positive. */
  saving: number;
  /** Candidate minus home, per measure; null when either side has no data. */
  deltas: Record<MetricId, number | null>;
  /** Minutes to the workplace; null until drive times are known. */
  minutes: number | null;
  /** True when `minutes` is a straight-line estimate, not a routed time. */
  minutesEstimated: boolean;
};

/** A saving smaller than this isn't worth moving for. */
export const MIN_SAVING: Record<Deal, number> = { rent: 400, buy: 150_000 };

const R = 6_371;
export function haversineKm(a: [number, number], b: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Rough door-to-door driving minutes from straight-line distance: roads are
 *  ~35% longer than the crow flies, urban average ~32 km/h, plus 4 minutes of
 *  parking / getting out. Only used when routed times are unavailable. */
export function estimateMinutes(km: number): number {
  return Math.round(((km * 1.35) / 32) * 60 + 4);
}

/** Straight-line radius (km) that can still be inside `maxMinutes` by car. */
export function reachKm(maxMinutes: number): number {
  return Math.max(4, maxMinutes * 0.95);
}

const delta = (a: number | null, b: number | null) => (a != null && b != null ? Math.round(a - b) : null);

/**
 * Everything cheaper than home for the same size, within straight-line reach of
 * the workplace. Not yet filtered by real drive time.
 */
export function findCandidates(
  index: IndexNeighborhood[],
  q: {
    home: IndexNeighborhood | null;
    homePrice: number;
    deal: Deal;
    rooms: RoomKey;
    work: [number, number];
    maxMinutes: number;
    /** The measures the family cares about. Defaults to schools, green, safety. */
    metrics?: MetricId[];
  },
): Alternative[] {
  const reach = reachKm(q.maxMinutes);
  const out: Alternative[] = [];
  for (const nb of index) {
    if (q.home && nb.id === q.home.id && nb.cityId === q.home.cityId) continue;
    const price = marketPrice(nb, q.deal, q.rooms);
    if (price == null) continue;
    const saving = q.homePrice - price;
    if (saving < MIN_SAVING[q.deal]) continue;
    const km = haversineKm(nb.center, q.work);
    if (km > reach) continue;
    out.push({
      nb,
      price,
      saving,
      deltas: Object.fromEntries(METRIC_IDS.map((m) => [m, delta(nb[m], q.home?.[m] ?? null)])) as Record<MetricId, number | null>,
      minutes: estimateMinutes(km),
      minutesEstimated: true,
    });
  }
  return out.sort(byWorth(q.homePrice, q.metrics));
}

/**
 * How good an alternative is, judged ONLY on the measures the family chose.
 * The saving leads; a chosen measure that is better adds to it and a worse one
 * subtracts — so a slightly smaller saving with better schools beats a big
 * saving somewhere clearly worse. A longer commute costs.
 */
export function quality(a: Alternative, homePrice: number, metrics: MetricId[] = DEFAULT_METRICS): number {
  const savingPct = (a.saving / homePrice) * 100; // 10% saving → 10
  let score = Math.min(savingPct, 35);
  for (const m of metrics) {
    const d = a.deltas[m];
    if (d != null) score += clamp(d / METRICS[m].per, -METRICS[m].cap, METRICS[m].cap);
  }
  return score - (a.minutes == null ? 0 : a.minutes * 0.25);
}

/** How many of the chosen measures are CLEARLY worse than home. Small gaps are
 *  noise (Meitzav averages over a handful of schools), so each has a
 *  tolerance. Unknown counts as not worse. */
export function worseCount(a: Alternative, metrics: MetricId[] = DEFAULT_METRICS): number {
  return metrics.filter((m) => {
    const d = a.deltas[m];
    return d != null && d < -METRICS[m].tolerance;
  }).length;
}

/** Order: places that give nothing up come first; within that, best quality.
 *  "Pay less for the same or better" is the promise — a bigger saving somewhere
 *  clearly worse only shows when nothing better exists. */
export const byWorth = (homePrice: number, metrics: MetricId[] = DEFAULT_METRICS) => (a: Alternative, b: Alternative) =>
  worseCount(a, metrics) - worseCount(b, metrics) || quality(b, homePrice, metrics) - quality(a, homePrice, metrics);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Final pick: inside the commute limit, best quality first, at most `perCity`
 * from one city so the three aren't all next door to each other.
 */
export function pickAlternatives(
  cands: Alternative[],
  q: { homePrice: number; maxMinutes: number; count?: number; perCity?: number; metrics?: MetricId[] },
): Alternative[] {
  const count = q.count ?? 3;
  const perCity = q.perCity ?? 2;
  const ranked = cands
    .filter((c) => c.minutes == null || c.minutes <= q.maxMinutes)
    .sort(byWorth(q.homePrice, q.metrics));
  const out: Alternative[] = [];
  const cityCount = new Map<string, number>();
  for (const c of ranked) {
    const n = cityCount.get(c.nb.cityId) ?? 0;
    if (n >= perCity) continue;
    cityCount.set(c.nb.cityId, n + 1);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

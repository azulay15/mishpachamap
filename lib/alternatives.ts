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
};

export type Alternative = {
  nb: IndexNeighborhood;
  price: number;
  /** Home price minus this one — always positive. */
  saving: number;
  /** Candidate minus home; null when either side has no data. */
  schoolsDelta: number | null;
  greenDelta: number | null;
  safetyDelta: number | null;
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
  q: { home: IndexNeighborhood | null; homePrice: number; deal: Deal; rooms: RoomKey; work: [number, number]; maxMinutes: number },
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
      schoolsDelta: delta(nb.schools, q.home?.schools ?? null),
      greenDelta: delta(nb.green, q.home?.green ?? null),
      safetyDelta: delta(nb.safety, q.home?.safety ?? null),
      minutes: estimateMinutes(km),
      minutesEstimated: true,
    });
  }
  return out.sort(byWorth(q.homePrice));
}

/**
 * How good an alternative is. The saving leads; better schools / green / safety
 * add to it and worse ones subtract — so a slightly smaller saving with better
 * schools beats a big saving somewhere clearly worse. A longer commute costs.
 */
export function quality(a: Alternative, homePrice: number): number {
  const savingPct = (a.saving / homePrice) * 100; // 10% saving → 10
  const schools = a.schoolsDelta == null ? 0 : clamp(a.schoolsDelta / 4, -8, 8); // Meitzav points
  const green = a.greenDelta == null ? 0 : clamp(a.greenDelta / 6, -6, 6);
  const safety = a.safetyDelta == null ? 0 : clamp(a.safetyDelta / 8, -5, 5);
  const commute = a.minutes == null ? 0 : a.minutes * 0.25;
  return Math.min(savingPct, 35) + schools + green + safety - commute;
}

/** How many of schools / green / safety are CLEARLY worse than home. Small
 *  gaps are noise (Meitzav averages over a handful of schools), so each has a
 *  tolerance. Unknown counts as not worse. */
export function worseCount(a: Alternative): number {
  return (
    (a.schoolsDelta != null && a.schoolsDelta < -12 ? 1 : 0) +
    (a.greenDelta != null && a.greenDelta < -10 ? 1 : 0) +
    (a.safetyDelta != null && a.safetyDelta < -10 ? 1 : 0)
  );
}

/** Order: places that give nothing up come first; within that, best quality.
 *  "Pay less for the same or better" is the promise — a bigger saving somewhere
 *  clearly worse only shows when nothing better exists. */
export const byWorth = (homePrice: number) => (a: Alternative, b: Alternative) =>
  worseCount(a) - worseCount(b) || quality(b, homePrice) - quality(a, homePrice);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Final pick: inside the commute limit, best quality first, at most `perCity`
 * from one city so the three aren't all next door to each other.
 */
export function pickAlternatives(
  cands: Alternative[],
  q: { homePrice: number; maxMinutes: number; count?: number; perCity?: number },
): Alternative[] {
  const count = q.count ?? 3;
  const perCity = q.perCity ?? 2;
  const ranked = cands
    .filter((c) => c.minutes == null || c.minutes <= q.maxMinutes)
    .sort(byWorth(q.homePrice));
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

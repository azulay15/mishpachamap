/**
 * Rent + sale prices BY APARTMENT SIZE — the shared, pure logic used by the
 * matcher, the price filter and the UI. Data comes from the per-city
 * `<city>.market.json` files (scripts/ingest/market.ts, nadlan.gov.il).
 *
 * Sizes are the ones the source publishes: 3, 4 and 5 rooms, plus "all".
 */

export type Deal = "buy" | "rent";
export type RoomKey = "3" | "4" | "5" | "all";
export const ROOM_KEYS: readonly RoomKey[] = ["3", "4", "5", "all"];

export type SizePrices = Partial<Record<RoomKey, number>>;

/** One neighborhood's (or one city's) figures. Rent is NIS / month. */
export type Market = {
  rent: SizePrices;
  buy: SizePrices;
  /** % change of all-sizes rent vs the previous year, when reported. */
  rentChangePct: number | null;
  /** Gross rental yield %, when reported. */
  yieldPct: number | null;
};

/** The active price filter on the map screen. */
export type PriceFilter = {
  deal: Deal;
  rooms: RoomKey;
  /** Upper price bound (NIS, or NIS/month for rent). Null = no bound. */
  max: number | null;
};

export const DEAL_LABEL: Record<Deal, string> = { buy: "קנייה", rent: "שכירות" };
export const ROOM_LABEL: Record<RoomKey, string> = { "3": "3 חד׳", "4": "4 חד׳", "5": "5 חד׳", all: "כל הגדלים" };

/** Upper-bound choices offered by the filter, per deal type. */
export const MAX_OPTIONS: Record<Deal, number[]> = {
  rent: [4000, 5000, 6000, 7000, 8000, 9000, 10_000, 12_000, 15_000],
  buy: [1_500_000, 2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 5_000_000, 6_000_000, 8_000_000],
};

/** The figure for one deal type + size, or null when the source has none. */
export function marketPrice(market: Market | null | undefined, deal: Deal, rooms: RoomKey): number | null {
  const v = market?.[deal]?.[rooms];
  return v != null && v > 0 ? v : null;
}

/** Room keys covering a persona's room range, clamped to the published sizes
 *  (a 2-room search is priced as 3 rooms, a 6-room one as 5). */
export function roomKeysForRange(min: number, max: number): RoomKey[] {
  const lo = Math.min(5, Math.max(3, Math.round(Math.min(min, max))));
  const hi = Math.min(5, Math.max(3, Math.round(Math.max(min, max))));
  const out: RoomKey[] = [];
  for (let r = lo; r <= hi; r++) out.push(String(r) as RoomKey);
  return out;
}

/** Average over the given sizes that have a figure. With `fallbackToAll`, a
 *  neighborhood that has none of those sizes falls back to its all-sizes
 *  figure. Null when there is nothing to go on. */
export function priceForSizes(
  market: Market | null | undefined,
  deal: Deal,
  keys: RoomKey[],
  fallbackToAll = true,
): number | null {
  const vals = keys.map((k) => marketPrice(market, deal, k)).filter((v): v is number => v != null);
  if (vals.length) return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return fallbackToAll ? marketPrice(market, deal, "all") : null;
}

/**
 * The price a list row / filter uses for a neighborhood.
 * Buying, all sizes → the Govmap median sale price (what the app already shows
 * as "חציון"), falling back to the source's all-sizes average. Everything else
 * comes straight from the by-size figures.
 */
export function filterPrice(
  n: { avgListing: number; market?: Market | null },
  filter: Pick<PriceFilter, "deal" | "rooms">,
): number | null {
  if (filter.deal === "buy" && filter.rooms === "all") {
    return n.avgListing > 0 ? n.avgListing : marketPrice(n.market, "buy", "all");
  }
  return marketPrice(n.market, filter.deal, filter.rooms);
}

/** Does a price pass the filter's upper bound? A neighborhood with no figure
 *  cannot be shown to fit a budget, so it fails once a bound is set. */
export function passesFilter(price: number | null, filter: Pick<PriceFilter, "max">): boolean {
  if (filter.max == null) return true;
  return price != null && price <= filter.max;
}

/** Does any neighborhood have a figure for this deal type? */
export function hasDeal(items: Array<{ avgListing: number; market?: Market | null }>, deal: Deal): boolean {
  return items.some((n) =>
    deal === "buy"
      ? n.avgListing > 0 || ROOM_KEYS.some((k) => marketPrice(n.market, "buy", k) != null)
      : ROOM_KEYS.some((k) => marketPrice(n.market, "rent", k) != null),
  );
}

/** Short money label: ₪7,800 for rent, ₪3.2M for a sale price. */
export function priceLabel(value: number, deal: Deal): string {
  if (deal === "rent") return `₪${Math.round(value).toLocaleString("en-US")}`;
  return value >= 1_000_000 ? `₪${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M` : `₪${Math.round(value / 1000)}K`;
}

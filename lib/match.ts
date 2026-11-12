import type { Persona } from "./persona";
import { priceForSizes, roomKeysForRange, type Market } from "./market";

export type MatchBreakdownRow = {
  label: string;
  weight: number;
  hit: number;
};

export type NeighborhoodFacts = {
  id: string;
  /** Avg listing price in NIS, from `neighborhood_metrics.avg_listing_price`. */
  avgListing: number | null;
  /** Rent + sale prices by apartment size (nadlan.gov.il). Null/absent = none. */
  market?: Market | null;
  /** % of recent listings with a garden (0-1). */
  gardenAvailability: number;
  /** Meters to nearest Meitzav-scored school inside the polygon (null if no school data). */
  schoolWalkMeters: number | null;
  /** Meters to nearest park POI. */
  parkMeters: number | null;
  /** Meters to nearest shop POI. */
  shopMeters: number | null;
  /** Meters to nearest transit POI. */
  transitMeters: number | null;
  /** Quiet score 0-100 (placeholder for V1). */
  quietScore: number;
  /** GreenScore 0-100, from neighborhood_metrics.green_score. */
  greenScore: number;
  /** Meters to nearest GF venue (null if no celiac POIs nearby). */
  celiacDistance: number | null;
  /** Count of GF venues within ~1km (proxy for "is this a celiac-friendly area"). */
  celiacDensity: number;
};

/** The features users can mark as must / nice in onboarding.
 *  These exact Hebrew strings are the source of truth — both the form chips
 *  and the matcher key off them. Adding/renaming requires updating both. */
export const FEATURES: readonly string[] = [
  "גינה צמודה",
  "בית ספר במרחק הליכה",
  "פארק קרוב",
  "מכולת/מרכול",
  "שקט",
  "תחבורה ציבורית",
  "GreenScore גבוה",
  "Celiac-Friendly",
];

/** Score a meters-distance against a "walkable" target (e.g. 400m = perfect). */
function distanceScore(meters: number | null, perfectMeters: number, awfulMeters: number): number {
  if (meters == null) return 0.5; // unknown → middling
  if (meters <= perfectMeters) return 1;
  if (meters >= awfulMeters) return 0;
  return 1 - (meters - perfectMeters) / (awfulMeters - perfectMeters);
}

/**
 * The price the budget is judged against: what a home of the family's size
 * costs here. Renting → monthly rent for their room count. Buying → the sale
 * price for their room count, else the neighborhood's overall sale price.
 */
export function budgetPrice(facts: NeighborhoodFacts, persona: Persona): number | null {
  const keys = roomKeysForRange(persona.rooms.min, persona.rooms.max);
  if (persona.deal === "rent") return priceForSizes(facts.market, "rent", keys);
  return (
    priceForSizes(facts.market, "buy", keys, false) ??
    (facts.avgListing != null && facts.avgListing > 0 ? facts.avgListing : null) ??
    priceForSizes(facts.market, "buy", [])
  );
}

/**
 * Score a budget fit: 1.0 inside the band. Above it the score falls off fast
 * (the family can't afford it). Below it the falloff is gentle and stops at
 * 0.6 — a cheaper neighborhood is affordable, just not what they are aiming
 * for — so it always ranks above "no price data" (0.5) and "too expensive".
 */
function budgetScore(facts: NeighborhoodFacts, persona: Persona): number {
  const price = budgetPrice(facts, persona);
  if (price == null || price <= 0) return 0.5;
  const { min, max } = persona.deal === "rent" ? persona.rentBudget : persona.budget;
  if (price >= min && price <= max) return 1;
  // Slack never collapses to zero for a narrow band.
  const slack = Math.max((max - min) * 0.3, max * 0.08);
  if (price < min) return Math.max(0.6, 1 - ((min - price) / min) * 0.8);
  return Math.max(0, 1 - (price - max) / slack);
}

/** Score a feature against the neighborhood facts. Returns 0..1. */
function featureScore(label: string, facts: NeighborhoodFacts): number {
  switch (label) {
    case "גינה צמודה":           return facts.gardenAvailability;
    case "בית ספר במרחק הליכה":  return distanceScore(facts.schoolWalkMeters, 400, 1500);
    case "פארק קרוב":             return distanceScore(facts.parkMeters, 300, 1200);
    case "מכולת/מרכול":           return distanceScore(facts.shopMeters, 400, 1200);
    case "שקט":                   return facts.quietScore / 100;
    case "תחבורה ציבורית":        return distanceScore(facts.transitMeters, 500, 2000);
    case "GreenScore גבוה":      return facts.greenScore / 100;
    case "Celiac-Friendly":      return distanceScore(facts.celiacDistance, 500, 2000);
    default:                      return 0.5;
  }
}

const BUDGET_WEIGHT = 25;
const MUST_WEIGHT = 15;
const NICE_WEIGHT = 5;

/**
 * Persona-driven breakdown.
 *
 *   - Budget always 25 weight.
 *   - Each feature in `persona.must` contributes 15 weight.
 *   - Each feature in `persona.nice` contributes 5 weight.
 *   - Features in neither don't appear in the breakdown.
 *   - If `persona.celiacInFamily` is true, Celiac-Friendly is auto-promoted to
 *     a must (founder's edge: dietary safety is non-negotiable for celiac
 *     households).
 *
 * Dedup: if the same label is in both must and nice, must wins. Weights are
 * renormalized to total 100.
 */
export function breakdownFor(facts: NeighborhoodFacts, persona: Persona): MatchBreakdownRow[] {
  const mustSet = new Set(persona.must);
  if (persona.celiacInFamily) mustSet.add("Celiac-Friendly");
  const niceSet = new Set(persona.nice.filter((n) => !mustSet.has(n)));

  const components: Array<{ label: string; weight: number; rawScore: number }> = [
    { label: "תקציב", weight: BUDGET_WEIGHT, rawScore: budgetScore(facts, persona) },
  ];

  for (const f of mustSet) {
    components.push({ label: f, weight: MUST_WEIGHT, rawScore: featureScore(f, facts) });
  }
  for (const f of niceSet) {
    components.push({ label: f, weight: NICE_WEIGHT, rawScore: featureScore(f, facts) });
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
  return components.map((c) => {
    const normalized = (c.weight / totalWeight) * 100;
    return {
      label: c.label,
      weight: Math.round(normalized),
      hit: Math.round(normalized * c.rawScore),
    };
  });
}

export const MATCH_BREAKDOWN: MatchBreakdownRow[] = [
  { label: "תקציב", weight: 25, hit: 24 },
  { label: "בית ספר במרחק הליכה", weight: 20, hit: 19 },
  { label: "גינה צמודה", weight: 15, hit: 14 },
  { label: "פארק קרוב", weight: 15, hit: 15 },
  { label: "מרכול במרחק 5 דק׳", weight: 10, hit: 9 },
  { label: "תחבורה ציבורית", weight: 10, hit: 7 },
  { label: "שקט", weight: 5, hit: 4 },
];

export function totalScore(rows: MatchBreakdownRow[] = MATCH_BREAKDOWN): number {
  return rows.reduce((sum, r) => sum + r.hit, 0);
}

export function scoreColor(score: number): string {
  if (score >= 90) return "var(--hn-green-700)";
  if (score >= 80) return "var(--hn-primary)";
  return "var(--hn-text-2)";
}

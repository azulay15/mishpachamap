/**
 * GreenScore breakdown — the 7 components that aggregate to the 0-100 score.
 *
 * V1: per-neighborhood values are derived from the neighborhood's overall
 * greenScore (centered on it, with each component pulled from a handoff
 * baseline distribution). V2 will replace each component with a real signal:
 *   - tree-canopy: NDVI from Sentinel-2 satellite imagery
 *   - parks: ST_Area of OSM `leisure=park` polygons within 500m of polygon
 *   - air-quality: PM2.5 hourly avg from data.gov.il / sviva.gov.il
 *   - noise: open-data noise heatmap (TBD source)
 *   - green-transit: bike-lane / EV-charger / EV-stop density
 *   - solar: rooftop-solar dataset (Israeli Ministry of Energy)
 *   - recycling: municipal recycling-bin density
 */

export type GreenScoreComponent = {
  /** Hebrew label, shown in the breakdown panel. */
  label: string;
  /** Weight 0-100 (must sum to 100 across all components). */
  weight: number;
  /** Sub-score 0-100. */
  value: number;
};

/** Handoff baseline (Bouchman-shaped). Used as the centerline; per-neighborhood
 *  values nudge each component up/down based on the overall greenScore.  */
const HANDOFF_BASELINE: { label: string; weight: number; value: number }[] = [
  { label: "צמרות עצים וגינון",       weight: 25, value: 92 },
  { label: "פארקים פתוחים במרחק הליכה", weight: 20, value: 86 },
  { label: "איכות אוויר (PM2.5)",       weight: 15, value: 78 },
  { label: "רעש סביבתי",                weight: 15, value: 71 },
  { label: "תחבורה ירוקה",              weight: 10, value: 80 },
  { label: "אנרגיה סולארית מותקנת",     weight: 10, value: 64 },
  { label: "פסולת ומיחזור",             weight: 5,  value: 88 },
];

/** Compute the per-component values for a neighborhood, biased so the weighted
 *  sum equals the neighborhood's overall greenScore. The shape (which signals
 *  are stronger vs weaker) is preserved from the baseline. */
export function breakdownForGreenScore(overallScore: number): GreenScoreComponent[] {
  const baselineWeightedSum = HANDOFF_BASELINE.reduce((s, c) => s + c.value * c.weight, 0) / 100;
  const offset = overallScore - baselineWeightedSum;
  return HANDOFF_BASELINE.map((c) => ({
    label: c.label,
    weight: c.weight,
    value: Math.max(0, Math.min(100, Math.round(c.value + offset))),
  }));
}

/** Color helper — map a 0-100 score to a CSS color for the bar fill. */
export function colorFor(value: number): string {
  if (value >= 85) return "var(--green-positive)";
  if (value >= 70) return "var(--layer-greenscore)";
  if (value >= 55) return "var(--mandarin-orange)";
  return "var(--red-negative)";
}

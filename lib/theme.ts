/**
 * Design tokens for the places CSS can't reach: Mapbox paint properties and
 * the raw-HTML map popups. Values are read live from the --hn-* custom
 * properties in styles/hanachala.css, so that file stays the single source of
 * truth (and a future dark theme flows through). FALLBACK holds the light
 * values for SSR and tests; lib/theme.test.ts keeps it in sync with the CSS.
 *
 * Every value must be a 6-digit hex: popups append an alpha suffix ("1A").
 */
import type { ExpressionSpecification } from "mapbox-gl";

export const FALLBACK = {
  "--hn-text": "#18181B",
  "--hn-text-2": "#52525B",
  "--hn-text-3": "#71717A",
  "--hn-surface": "#FFFFFF",
  "--hn-surface-2": "#F4F4F5",
  "--hn-accent": "#18181B",
  "--hn-positive": "#177A42",
  "--hn-positive-bg": "#EEF7F1",
  "--hn-warning": "#9A5D00",
  "--hn-warning-bg": "#FBF0DD",
  "--hn-link": "#18181B",
  "--hn-map-land": "#F3F3F1",
  "--hn-map-edge": "#FFFFFF",
  "--hn-map-landuse": "#EDEDEA",
  "--hn-map-park": "#DCEAD6",
  "--hn-map-building": "#E6E6E3",
  "--hn-map-road": "#FFFFFF",
  "--hn-map-road-case": "#DADAD6",
  "--hn-map-highway": "#F6E3C5",
  "--hn-map-highway-case": "#E3C79C",
  "--hn-map-hover": "#18181B",
  "--hn-map-dim": "#E4E4E7",
  "--hn-score-1": "#EFEFF0",
  "--hn-score-2": "#DCE9DF",
  "--hn-score-3": "#AED3B9",
  "--hn-score-4": "#62AE7E",
  "--hn-score-5": "#1F7A45",
  "--hn-poi-price": "#18181B",
  "--hn-poi-school": "#2B5FA8",
  "--hn-poi-preschool": "#5B93D6",
  "--hn-poi-park": "#2E7D4F",
  "--hn-poi-shop": "#B86E00",
  "--hn-poi-transit": "#5B6670",
  "--hn-poi-community": "#7A5BC0",
  "--hn-poi-clinic": "#C2477E",
  "--hn-poi-celiac": "#C2477E",
  "--hn-poi-playground": "#D9661F",
} as const;

export type TokenName = keyof typeof FALLBACK;

/** Current value of a design token (live CSS on the client, FALLBACK on the server). */
export function token(name: TokenName): string {
  if (typeof window === "undefined" || typeof document === "undefined") return FALLBACK[name];
  const live = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(live) ? live : FALLBACK[name];
}

const POI_TOKEN: Record<string, TokenName> = {
  price: "--hn-poi-price",
  school: "--hn-poi-school",
  preschool: "--hn-poi-preschool",
  park: "--hn-poi-park",
  greenscore: "--hn-poi-park",
  shop: "--hn-poi-shop",
  transit: "--hn-poi-transit",
  community: "--hn-poi-community",
  clinic: "--hn-poi-clinic",
  celiac: "--hn-poi-celiac",
  playground: "--hn-poi-playground",
};

/** Colour for a POI / layer type; unknown types get the tertiary text colour. */
export function poiColor(type: string): string {
  const t = POI_TOKEN[type];
  return token(t ?? "--hn-text-3");
}

/** Match-score thresholds for the map ramp (score-1 below the first). */
export const SCORE_STEPS = [55, 60, 70, 80] as const;

/** Bucket a 0–100 match score into the 1–5 ramp used on the map. */
export function scoreStep(score: number): 1 | 2 | 3 | 4 | 5 {
  let step = 1;
  for (const t of SCORE_STEPS) if (score >= t) step++;
  return step as 1 | 2 | 3 | 4 | 5;
}

/** Mapbox `fill-color` expression: neighborhoods coloured by `match_score`. */
export function scoreFillExpression(): ExpressionSpecification {
  return [
    "case",
    // Ruled out by the price filter → neutral, so what fits stands out.
    ["==", ["get", "dim"], true],
    token("--hn-map-dim"),
    [
      "step",
      ["coalesce", ["get", "match_score"], 0],
      token("--hn-score-1"),
      SCORE_STEPS[0], token("--hn-score-2"),
      SCORE_STEPS[1], token("--hn-score-3"),
      SCORE_STEPS[2], token("--hn-score-4"),
      SCORE_STEPS[3], token("--hn-score-5"),
    ],
  ] as ExpressionSpecification;
}

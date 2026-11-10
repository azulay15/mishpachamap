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
  "--hn-text": "#14231A",
  "--hn-text-2": "#4A5A50",
  "--hn-text-3": "#637267",
  "--hn-surface": "#FFFFFF",
  "--hn-surface-2": "#EDF3EE",
  "--hn-accent": "#EF6A1B",
  "--hn-positive": "#1F7A45",
  "--hn-positive-bg": "#E3F1E6",
  "--hn-warning": "#9A5D00",
  "--hn-warning-bg": "#FBF0DD",
  "--hn-link": "#19663A",
  "--hn-map-land": "#E9EFE8",
  "--hn-map-edge": "#FFFFFF",
  "--hn-map-landuse": "#E1E9DF",
  "--hn-map-park": "#CFE3C8",
  "--hn-map-building": "#DCE4DB",
  "--hn-map-road": "#FFFFFF",
  "--hn-map-road-case": "#CCD7CD",
  "--hn-map-highway": "#F3D2A6",
  "--hn-map-highway-case": "#DDB27C",
  "--hn-map-hover": "#14231A",
  "--hn-score-1": "#E3F1E6",
  "--hn-score-2": "#BADFC3",
  "--hn-score-3": "#85C496",
  "--hn-score-4": "#4AA16A",
  "--hn-score-5": "#1F7A45",
  "--hn-poi-price": "#14231A",
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
    "step",
    ["coalesce", ["get", "match_score"], 0],
    token("--hn-score-1"),
    SCORE_STEPS[0], token("--hn-score-2"),
    SCORE_STEPS[1], token("--hn-score-3"),
    SCORE_STEPS[2], token("--hn-score-4"),
    SCORE_STEPS[3], token("--hn-score-5"),
  ] as ExpressionSpecification;
}

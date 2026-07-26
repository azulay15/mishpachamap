/**
 * Helpers for building search URLs on external real-estate sites.
 *
 * Each function returns a URL that opens a pre-filled search on the target
 * site. We don't deep-link to specific listings (the URLs aren't stable
 * across sites) — we just open a search the user can refine.
 *
 * Used by PropertyDetailSheet + ListingsPanel for "View on Yad2 / Madlan /
 * nadlan.gov.il" actions until real listing/transaction ingest lands.
 *
 * City-aware: pass an `ExternalCity` to target a specific city. The default
 * reproduces the original Modi'in behavior exactly (so callers that don't yet
 * pass a city — and the unit tests — are unchanged).
 */

export type ExternalCity = {
  /** Yad2's city id (== CBS semel for the cities we cover). */
  yad2Id: number;
  /** Short city name for the Madlan free-text query (e.g. "מודיעין"). */
  madlanName: string;
  /** Full city name for the nadlan.gov.il query (e.g. "מודיעין-מכבים-רעות"). */
  nadlanName: string;
};

/** Default target: Modi'in-Maccabim-Re'ut (semel 1200). */
const DEFAULT_CITY: ExternalCity = {
  yad2Id: 1200,
  madlanName: "מודיעין",
  nadlanName: "מודיעין-מכבים-רעות",
};

/** Yad2 listings search — filtered to the city, free-text address. */
export function yad2SearchUrl(addressOrNeighborhoodHe: string, city: ExternalCity = DEFAULT_CITY): string {
  const q = encodeURIComponent(addressOrNeighborhoodHe);
  return `https://www.yad2.co.il/realestate/forsale?city=${city.yad2Id}&searchOrder=1&searchKey=${q}`;
}

/** Madlan listings search — free-text query in Hebrew. */
export function madlanSearchUrl(addressOrNeighborhoodHe: string, city: ExternalCity = DEFAULT_CITY): string {
  const q = encodeURIComponent(`${addressOrNeighborhoodHe}, ${city.madlanName}`);
  return `https://www.madlan.co.il/for-sale?term=${q}`;
}

/** nadlan.gov.il historical transactions — opens the gov real-estate site
 *  with a pre-filled search term. */
export function nadlanGovSearchUrl(addressOrNeighborhoodHe: string, city: ExternalCity = DEFAULT_CITY): string {
  const q = encodeURIComponent(`${addressOrNeighborhoodHe} ${city.nadlanName}`);
  return `https://www.nadlan.gov.il/?search=${q}`;
}

/** Convenience: all three URLs for a given address or neighborhood string. */
export function externalSearchUrls(addressOrNeighborhoodHe: string, city: ExternalCity = DEFAULT_CITY) {
  return {
    yad2: yad2SearchUrl(addressOrNeighborhoodHe, city),
    madlan: madlanSearchUrl(addressOrNeighborhoodHe, city),
    nadlan: nadlanGovSearchUrl(addressOrNeighborhoodHe, city),
  };
}

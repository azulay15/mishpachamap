/**
 * Helpers for building search URLs on external real-estate sites.
 *
 * Each function returns a URL that opens a pre-filled search on the target
 * site. We don't deep-link to specific listings (the URLs aren't stable
 * across sites) — we just open a search the user can refine.
 *
 * Used by PropertyDetailSheet + ListingsPanel for "View on Yad2 / Madlan /
 * nadlan.gov.il" actions until real listing/transaction ingest lands.
 */

const MODIIN_YAD2_CITY_ID = 1200;

/** Yad2 listings search — filtered to Modi'in city, free-text address. */
export function yad2SearchUrl(addressOrNeighborhoodHe: string): string {
  const q = encodeURIComponent(addressOrNeighborhoodHe);
  return `https://www.yad2.co.il/realestate/forsale?city=${MODIIN_YAD2_CITY_ID}&searchOrder=1&searchKey=${q}`;
}

/** Madlan listings search — free-text query in Hebrew. */
export function madlanSearchUrl(addressOrNeighborhoodHe: string): string {
  const q = encodeURIComponent(`${addressOrNeighborhoodHe}, מודיעין`);
  return `https://www.madlan.co.il/for-sale?term=${q}`;
}

/** nadlan.gov.il historical transactions — opens the gov real-estate site
 *  with a pre-filled search term. */
export function nadlanGovSearchUrl(addressOrNeighborhoodHe: string): string {
  const q = encodeURIComponent(`${addressOrNeighborhoodHe} מודיעין-מכבים-רעות`);
  return `https://www.nadlan.gov.il/?search=${q}`;
}

/** Convenience: all three URLs for a given address or neighborhood string. */
export function externalSearchUrls(addressOrNeighborhoodHe: string) {
  return {
    yad2: yad2SearchUrl(addressOrNeighborhoodHe),
    madlan: madlanSearchUrl(addressOrNeighborhoodHe),
    nadlan: nadlanGovSearchUrl(addressOrNeighborhoodHe),
  };
}

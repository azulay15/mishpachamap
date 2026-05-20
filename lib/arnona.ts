/**
 * Arnona (Israeli municipal property tax) helpers.
 *
 * Rates are sourced from `public/arnona_modiin.json` — a tiny static file that
 * any contributor can edit without touching code. Loaded at build time via
 * TypeScript JSON import (tsconfig has `resolveJsonModule: true`), so this
 * runs equally on the server and in the browser bundle.
 */
import data from "@/public/arnona_modiin.json";

type Rate = {
  nis_per_sqm_year: number;
  zone: string;
  verified: boolean;
};

const RATES = data.rates as Record<string, Rate>;

/** The neighborhood-level rate (rate per m² per year, in NIS). */
export function arnonaRateFor(neighborhoodId: string): Rate | null {
  return RATES[neighborhoodId] ?? null;
}

/** Monthly bill in NIS for a property of `sqm` square meters in this rate's zone. */
export function monthlyArnona(rate: Rate, sqm: number): number {
  return Math.round((rate.nis_per_sqm_year * sqm) / 12);
}

/** Schema-stable disclaimer string for UI footers. */
export const ARNONA_DISCLAIMER =
  "סכום ארנונה הוא הערכה לפי תעריפי מודיעין; הסכום בפועל נקבע על-ידי העירייה.";

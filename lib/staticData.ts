/**
 * Server-only loaders for the enrichment data that lives in static JSON files
 * (same pattern as lib/geoData.ts). These carry REAL data joined per
 * neighborhood — CBS-census demographics, Police safety, the authoritative MoE
 * schools list, and Open Bus transit — and need no DB migration.
 *
 * All loaders are city-parameterized: they read the file named in the city's
 * registry entry (lib/cities.ts) and default to the default city so any
 * remaining no-arg caller keeps its old behavior. A missing file (a city whose
 * ingests haven't been run yet) returns an empty result instead of throwing, so
 * a "coming-soon" city degrades gracefully; a present-but-corrupt file still
 * throws.
 *
 * Generated per city by the ingest scripts, e.g. for Modi'in:
 *   npm run ingest:demographics   → public/neighborhoods.demographics.json
 *   npm run ingest:crime          → public/neighborhoods.crime.json
 *   npm run ingest:schools:moe    → public/schools.modiin.json
 *   npm run ingest:transit        → public/transit.modiin.json
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultCity, type City } from "@/lib/cities";

/** Read a public/ JSON file, or return `fallback` if the file doesn't exist. */
function readJsonSafe<T>(file: string, fallback: T): T {
  const path = join(process.cwd(), "public", file);
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Per-neighborhood demographics from CBS Census 2022. `null` = no coverage. */
export type Demographics = {
  population: number;
  households: number;
  household_size: number | null;
  median_age: number | null;
  pct_age_0_19: number | null;
  pct_households_with_kids_0_5: number | null;
  avg_children_born: number | null;
  pct_academic: number | null;
  median_wage_monthly: number | null;
  pct_own: number | null;
  religiosity: string | null;
};

/** Per-neighborhood safety from Police 2024 data. `null` = no coverage. */
export type Safety = {
  cases_2024_total: number;
  per_1000_residents: number | null;
  safety_score: number | null;
  safety_rank: number | null;
  safety_rank_of: number;
};

export type StaticSchool = {
  semel: number;
  name_he: string;
  level: string;
  grade_from: number | null;
  grade_to: number | null;
  sector: string | null;
  supervision: string | null;
  students: number | null;
  offers_bagrut: boolean;
  lon: number | null;
  lat: number | null;
  meitzav_score: number | null;
  meitzav_year: number | null;
};

/** OSM-derived GreenScore + quiet per neighborhood (from environment.ts). */
export type Environment = { green_score: number; quiet_score: number | null };

/** Govmap sale-price metrics per neighborhood (from prices.ts). `null` = not
 *  enough recent sales to publish honestly. */
export type Prices = {
  avg_price_per_m2: number | null;
  avg_listing_price: number | null;
  avg_price_yoy_pct: number | null;
  median_rooms: number | null;
};

/** Per-neighborhood sale prices. Empty when the city has no prices file
 *  (callers then fall back to the DB metrics — Modi'in's legacy path). */
export function loadPrices(city: City = defaultCity()): Record<string, Prices | null> {
  if (!city.files.prices) return {};
  return readJsonSafe<{ neighborhoods: Record<string, Prices | null> }>(city.files.prices, {
    neighborhoods: {},
  }).neighborhoods;
}

export type BusStop = { code: number; name: string; lat: number; lon: number };

/**
 * Per-neighborhood green/quiet. Empty object when the city has no environment
 * file (callers then fall back to the DB metrics — Modi'in's legacy path).
 */
export function loadEnvironment(city: City = defaultCity()): Record<string, Environment> {
  if (!city.files.environment) return {};
  return readJsonSafe<{ neighborhoods: Record<string, Environment> }>(city.files.environment, {
    neighborhoods: {},
  }).neighborhoods;
}

export function loadDemographics(city: City = defaultCity()): Record<string, Demographics | null> {
  return readJsonSafe<{ neighborhoods: Record<string, Demographics | null> }>(city.files.demographics, {
    neighborhoods: {},
  }).neighborhoods;
}

export function loadSafety(city: City = defaultCity()): Record<string, Safety | null> {
  return readJsonSafe<{ neighborhoods: Record<string, Safety | null> }>(city.files.crime, {
    neighborhoods: {},
  }).neighborhoods;
}

export function loadSchools(city: City = defaultCity()): StaticSchool[] {
  return readJsonSafe<{ schools: StaticSchool[] }>(city.files.schools, { schools: [] }).schools.filter(
    (s) => s.lon != null && s.lat != null,
  );
}

export function loadTransitStops(city: City = defaultCity()): BusStop[] {
  return readJsonSafe<{ stops: BusStop[] }>(city.files.transit, { stops: [] }).stops;
}

/**
 * App-level city registry — the single source of truth for WHICH cities the
 * product covers, how the map should frame each one, and which static data
 * files hold each city's enrichment. Read at request time by the Home page,
 * the `/map/[city]` route, and lib/assembleConcierge.
 *
 * This is deliberately separate from scripts/ingest/cities.ts: that one is the
 * BUILD config (CBS anchors, clip buffers) used by the polygon pipeline under
 * tsx; this one is the RUNTIME config (display names, map center, file paths)
 * used by the Next app. They overlap only in `id` + `semel` — kept in sync by
 * hand, which is cheap (a handful of fields per city).
 *
 * Adding a city to the app = one entry here + its static files in public/.
 * A city with `status: "coming-soon"` shows in the picker but its map is a
 * teaser until the files land (the loaders degrade gracefully if files are
 * missing, so a half-built city never crashes the route).
 */

import type { ExternalCity } from "./externalLinks";

export type CityStatus = "live" | "coming-soon";

/** Basenames (under public/) of a city's static enrichment files. */
export type CityFiles = {
  /** Neighborhood polygons — GeoJSON FeatureCollection. Source of truth for
   *  "which neighborhoods exist" (the DB only enriches). */
  geo: string;
  /** CBS census demographics, keyed by neighborhood id. */
  demographics: string;
  /** Police safety signal, keyed by neighborhood id. */
  crime: string;
  /** Authoritative MoE schools list. */
  schools: string;
  /** Open Bus Stride bus stops. */
  transit: string;
  /** OSM-derived GreenScore + quiet per neighborhood. Optional — when the file
   *  is absent the app falls back to the DB metrics (Modi'in's legacy path). */
  environment?: string;
  /** Govmap sale-price metrics per neighborhood. Optional — absent → the app
   *  falls back to the DB metrics (Modi'in's legacy path). */
  prices?: string;
};

export type City = {
  /** Stable slug — matches ingest config + neighborhood-id prefix. */
  id: string;
  /** URL segment for /map/[city]. Usually == id, but may hyphenate. */
  slug: string;
  name_he: string;
  name_en: string;
  /** CBS locality code (סמל יישוב). */
  semel: number;
  /** Map center [lng, lat] used before fitBounds settles. */
  center: [number, number];
  /** Initial map zoom before fitBounds settles. */
  zoom: number;
  status: CityStatus;
  files: CityFiles;
  /** Short Hebrew tagline for the city card on Home. */
  tagline_he?: string;
  /** Short city name for external real-estate searches (Madlan). Defaults to
   *  name_he. e.g. Modi'in's full name is "מודיעין-מכבים-רעות" but searches use
   *  "מודיעין". */
  searchName?: string;
};

const modiin: City = {
  id: "modiin",
  slug: "modiin",
  name_he: "מודיעין-מכבים-רעות",
  name_en: "Modi'in-Maccabim-Re'ut",
  semel: 1200,
  center: [35.0078, 31.8969],
  zoom: 13,
  status: "live",
  tagline_he: "14 שכונות · נתוני אמת מלאים",
  searchName: "מודיעין",
  // Legacy filenames (predate the multi-city convention) — kept as-is so the
  // rename churn stays out of this change. New cities use the `<id>.*` form.
  files: {
    geo: "neighborhoods.geo.json",
    demographics: "neighborhoods.demographics.json",
    crime: "neighborhoods.crime.json",
    schools: "schools.modiin.json",
    transit: "transit.modiin.json",
    environment: "modiin.environment.json",
    prices: "modiin.prices.json",
  },
};

/**
 * Or Yehuda (semel pending confirmation — 2400) — the second city. Provisional
 * `center` from the city core; refined once the neighborhood research + polygon
 * build land. Starts "coming-soon" so the picker + switcher can be built and
 * tested before its data files exist; flip to "live" when the files are in.
 */
const oryehuda: City = {
  id: "oryehuda",
  slug: "or-yehuda",
  name_he: "אור יהודה",
  name_en: "Or Yehuda",
  semel: 2400,
  center: [34.8533, 32.0306],
  zoom: 13.5,
  status: "live",
  tagline_he: "8 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.oryehuda.geo.json",
    demographics: "oryehuda.demographics.json",
    crime: "oryehuda.crime.json",
    schools: "oryehuda.schools.json",
    transit: "oryehuda.transit.json",
    environment: "oryehuda.environment.json",
    prices: "oryehuda.prices.json",
  },
};

/**
 * Rishon LeZion (semel pending confirmation — 8300) — the third city. Provisional
 * center/semel until the neighborhood research + polygon build land. Starts
 * "coming-soon" so it shows in the picker while its data is built.
 */
const rishon: City = {
  id: "rishon",
  slug: "rishon-lezion",
  name_he: "ראשון לציון",
  name_en: "Rishon LeZion",
  semel: 8300,
  center: [34.8044, 31.9642],
  zoom: 12.5,
  status: "live",
  tagline_he: "34 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.rishon.geo.json",
    demographics: "rishon.demographics.json",
    crime: "rishon.crime.json",
    schools: "rishon.schools.json",
    transit: "rishon.transit.json",
    environment: "rishon.environment.json",
    prices: "rishon.prices.json",
  },
};

/** All cities, in display order. */
export const CITIES: City[] = [modiin, oryehuda, rishon];

/** The city shown when no city is specified (legacy `/map` deep links). */
export const DEFAULT_CITY_ID = "modiin";

const byId = new Map(CITIES.map((c) => [c.id, c]));
const bySlug = new Map(CITIES.map((c) => [c.slug, c]));

/** Resolve a city by id OR url slug. Returns undefined if unknown. */
export function getCity(idOrSlug: string): City | undefined {
  return byId.get(idOrSlug) ?? bySlug.get(idOrSlug);
}

/** The default city, guaranteed to exist. */
export function defaultCity(): City {
  return byId.get(DEFAULT_CITY_ID)!;
}

/** Cities with real data wired up (shown as tappable on Home). */
export function liveCities(): City[] {
  return CITIES.filter((c) => c.status === "live");
}

/** External real-estate search descriptor for a city (Yad2/Madlan/nadlan.gov). */
export function cityExternal(city: City): ExternalCity {
  return {
    yad2Id: city.semel,
    madlanName: city.searchName ?? city.name_he,
    nadlanName: city.name_he,
  };
}

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
  /** Rent + sale prices by apartment size per neighborhood (nadlan.gov.il,
   *  from scripts/ingest/market.ts). Optional — absent → no by-size figures. */
  market?: string;
  /** Parks, playgrounds, grocery shops, preschools and community places from
   *  OpenStreetMap (scripts/ingest/pois.ts). Optional. */
  pois?: string;
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
  /** BCP-47 language of this city's UI + data. Defaults to Hebrew. */
  lang?: "he" | "en";
  /** Text direction. Defaults to RTL (Israeli cities); NYC etc. are LTR. */
  dir?: "rtl" | "ltr";
  /** Country — gates country-specific UI (e.g. the Israeli listing-site links). */
  country?: "IL" | "US";
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
    market: "modiin.market.json",
    pois: "modiin.pois.json",
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
    market: "oryehuda.market.json",
    pois: "oryehuda.pois.json",
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
    market: "rishon.market.json",
    pois: "rishon.pois.json",
  },
};

/** Kfar Saba (semel 6900) — the fourth city (Sharon, ~101k). Provisional
 *  center; starts "coming-soon" until its research + build land. */
const kefarsava: City = {
  id: "kefarsava",
  slug: "kfar-saba",
  name_he: "כפר סבא",
  name_en: "Kfar Saba",
  semel: 6900,
  center: [34.9046, 32.1743],
  zoom: 13,
  status: "live",
  tagline_he: "18 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.kefarsava.geo.json",
    demographics: "kefarsava.demographics.json",
    crime: "kefarsava.crime.json",
    schools: "kefarsava.schools.json",
    transit: "kefarsava.transit.json",
    environment: "kefarsava.environment.json",
    prices: "kefarsava.prices.json",
    market: "kefarsava.market.json",
    pois: "kefarsava.pois.json",
  },
};

/**
 * New York City (Manhattan) — the international POC. Proves the app isn't
 * Israel-specific: same geo-first engine, US open-data adapters (NYC 2020 NTAs,
 * NYPD complaints, DOE schools + NY State proficiency, MTA subway, OSM), and
 * English/LTR instead of Hebrew/RTL. `semel` is unused here (an Israeli CBS
 * concept) — `country: "US"` gates the Israeli-only UI.
 * Prices are deferred (DOF sales have no coordinates; see docs).
 */
const nyc: City = {
  id: "nyc",
  slug: "nyc",
  name_he: "New York City",
  name_en: "New York City",
  semel: 0,
  center: [-73.9712, 40.7831],
  zoom: 11.5,
  status: "live",
  tagline_he: "32 Manhattan neighborhoods · real data",
  lang: "en",
  dir: "ltr",
  country: "US",
  files: {
    geo: "neighborhoods.nyc.geo.json",
    demographics: "nyc.demographics.json", // pending a Census API key
    crime: "nyc.crime.json",
    schools: "nyc.schools.json",
    transit: "nyc.transit.json",
    environment: "nyc.environment.json",
    prices: "nyc.prices.json", // deferred (DOF sales lack coordinates)
  },
};

/** Ra'anana — 15 neighborhoods (27 CBS stat areas, 2 discarded). */
const raanana: City = {
  id: "raanana",
  slug: "raanana",
  name_he: "רעננה",
  name_en: "Ra'anana",
  semel: 8700,
  center: [34.8686, 32.1848],
  zoom: 13.2,
  status: "live",
  tagline_he: "15 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.raanana.geo.json",
    demographics: "raanana.demographics.json",
    crime: "raanana.crime.json",
    schools: "raanana.schools.json",
    transit: "raanana.transit.json",
    environment: "raanana.environment.json",
    prices: "raanana.prices.json",
    market: "raanana.market.json",
    pois: "raanana.pois.json",
  },
};

/** Herzliya — 15 neighborhoods (36 CBS stat areas, 8 discarded). */
const herzliya: City = {
  id: "herzliya",
  slug: "herzliya",
  name_he: "הרצליה",
  name_en: "Herzliya",
  semel: 6400,
  center: [34.8362, 32.1656],
  zoom: 12.8,
  status: "live",
  tagline_he: "15 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.herzliya.geo.json",
    demographics: "herzliya.demographics.json",
    crime: "herzliya.crime.json",
    schools: "herzliya.schools.json",
    transit: "herzliya.transit.json",
    environment: "herzliya.environment.json",
    prices: "herzliya.prices.json",
    market: "herzliya.market.json",
    pois: "herzliya.pois.json",
  },
};

/** Netanya — 27 neighborhoods (73 CBS stat areas, 8 discarded). */
const netanya: City = {
  id: "netanya",
  slug: "netanya",
  name_he: "נתניה",
  name_en: "Netanya",
  semel: 7400,
  center: [34.8613, 32.3126],
  zoom: 12.3,
  status: "live",
  tagline_he: "27 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.netanya.geo.json",
    demographics: "netanya.demographics.json",
    crime: "netanya.crime.json",
    schools: "netanya.schools.json",
    transit: "netanya.transit.json",
    environment: "netanya.environment.json",
    prices: "netanya.prices.json",
    market: "netanya.market.json",
    pois: "netanya.pois.json",
  },
};

/** Petah Tikva — 29 neighborhoods (81 CBS stat areas, 8 discarded). Largest city in the app. */
const petahtikva: City = {
  id: "petahtikva",
  slug: "petah-tikva",
  name_he: "פתח תקווה",
  name_en: "Petah Tikva",
  semel: 7900,
  center: [34.8878, 32.0898],
  zoom: 12.6,
  status: "live",
  tagline_he: "29 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.petahtikva.geo.json",
    demographics: "petahtikva.demographics.json",
    crime: "petahtikva.crime.json",
    schools: "petahtikva.schools.json",
    transit: "petahtikva.transit.json",
    environment: "petahtikva.environment.json",
    prices: "petahtikva.prices.json",
    market: "petahtikva.market.json",
    pois: "petahtikva.pois.json",
  },
};

/** Haifa — 40 neighborhoods (106 CBS stat areas, 18 discarded). */
const haifa: City = {
  id: "haifa",
  slug: "haifa",
  name_he: "חיפה",
  name_en: "Haifa",
  semel: 4000,
  center: [35.0179, 32.8025],
  zoom: 12,
  status: "live",
  tagline_he: "40 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.haifa.geo.json",
    demographics: "haifa.demographics.json",
    crime: "haifa.crime.json",
    schools: "haifa.schools.json",
    transit: "haifa.transit.json",
    environment: "haifa.environment.json",
    prices: "haifa.prices.json",
    market: "haifa.market.json",
    pois: "haifa.pois.json",
  },
};

/** Jerusalem — 66 neighborhoods (243 CBS stat areas, 25 discarded). Largest city in the app. */
const jerusalem: City = {
  id: "jerusalem",
  slug: "jerusalem",
  name_he: "ירושלים",
  name_en: "Jerusalem",
  semel: 3000,
  center: [35.2092, 31.8001],
  zoom: 11.4,
  status: "live",
  tagline_he: "66 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.jerusalem.geo.json",
    demographics: "jerusalem.demographics.json",
    crime: "jerusalem.crime.json",
    schools: "jerusalem.schools.json",
    transit: "jerusalem.transit.json",
    environment: "jerusalem.environment.json",
    prices: "jerusalem.prices.json",
    market: "jerusalem.market.json",
    pois: "jerusalem.pois.json",
  },
};


/** Ramat Gan — 26 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const ramatgan: City = {
  id: "ramatgan",
  slug: "ramat-gan",
  name_he: "רמת גן",
  name_en: "Ramat Gan",
  semel: 8600,
  center: [34.8261, 32.0698],
  zoom: 13.1,
  status: "live",
  tagline_he: "26 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.ramatgan.geo.json",
    demographics: "ramatgan.demographics.json",
    crime: "ramatgan.crime.json",
    schools: "ramatgan.schools.json",
    transit: "ramatgan.transit.json",
    environment: "ramatgan.environment.json",
    prices: "ramatgan.prices.json", // not built yet (Govmap refuses automated requests)
    market: "ramatgan.market.json",
    pois: "ramatgan.pois.json",
  },
};


/** Givatayim — 11 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const givatayim: City = {
  id: "givatayim",
  slug: "givatayim",
  name_he: "גבעתיים",
  name_en: "Givatayim",
  semel: 6300,
  center: [34.8094, 32.0702],
  zoom: 13.6,
  status: "live",
  tagline_he: "11 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.givatayim.geo.json",
    demographics: "givatayim.demographics.json",
    crime: "givatayim.crime.json",
    schools: "givatayim.schools.json",
    transit: "givatayim.transit.json",
    environment: "givatayim.environment.json",
    prices: "givatayim.prices.json", // not built yet (Govmap refuses automated requests)
    market: "givatayim.market.json",
    pois: "givatayim.pois.json",
  },
};


/** Holon — 21 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const holon: City = {
  id: "holon",
  slug: "holon",
  name_he: "חולון",
  name_en: "Holon",
  semel: 6600,
  center: [34.7836, 32.0143],
  zoom: 13.5,
  status: "live",
  tagline_he: "21 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.holon.geo.json",
    demographics: "holon.demographics.json",
    crime: "holon.crime.json",
    schools: "holon.schools.json",
    transit: "holon.transit.json",
    environment: "holon.environment.json",
    prices: "holon.prices.json", // not built yet (Govmap refuses automated requests)
    market: "holon.market.json",
    pois: "holon.pois.json",
  },
};


/** Bat Yam — 8 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const batyam: City = {
  id: "batyam",
  slug: "bat-yam",
  name_he: "בת ים",
  name_en: "Bat Yam",
  semel: 6200,
  center: [34.7490, 32.0155],
  zoom: 13.6,
  status: "live",
  tagline_he: "8 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.batyam.geo.json",
    demographics: "batyam.demographics.json",
    crime: "batyam.crime.json",
    schools: "batyam.schools.json",
    transit: "batyam.transit.json",
    environment: "batyam.environment.json",
    prices: "batyam.prices.json", // not built yet (Govmap refuses automated requests)
    market: "batyam.market.json",
    pois: "batyam.pois.json",
  },
};


/** Be'er Sheva — 17 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const beersheva: City = {
  id: "beersheva",
  slug: "beer-sheva",
  name_he: "באר שבע",
  name_en: "Be'er Sheva",
  semel: 9000,
  center: [34.7871, 31.2504],
  zoom: 12.7,
  status: "live",
  tagline_he: "17 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.beersheva.geo.json",
    demographics: "beersheva.demographics.json",
    crime: "beersheva.crime.json",
    schools: "beersheva.schools.json",
    transit: "beersheva.transit.json",
    environment: "beersheva.environment.json",
    prices: "beersheva.prices.json", // not built yet (Govmap refuses automated requests)
    market: "beersheva.market.json",
    pois: "beersheva.pois.json",
  },
};


/** Tel Aviv-Yafo — 61 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const telaviv: City = {
  id: "telaviv",
  slug: "tel-aviv",
  name_he: "תל אביב-יפו",
  name_en: "Tel Aviv-Yafo",
  semel: 5000,
  center: [34.7941, 32.0790],
  zoom: 12.3,
  status: "live",
  tagline_he: "61 שכונות · נתוני אמת",
  searchName: "תל אביב",
  files: {
    geo: "neighborhoods.telaviv.geo.json",
    demographics: "telaviv.demographics.json",
    crime: "telaviv.crime.json",
    schools: "telaviv.schools.json",
    transit: "telaviv.transit.json",
    environment: "telaviv.environment.json",
    prices: "telaviv.prices.json", // not built yet (Govmap refuses automated requests)
    market: "telaviv.market.json",
    pois: "telaviv.pois.json",
  },
};


/** Ramat HaSharon — 9 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const ramathasharon: City = {
  id: "ramathasharon",
  slug: "ramat-hasharon",
  name_he: "רמת השרון",
  name_en: "Ramat HaSharon",
  semel: 2650,
  center: [34.8385, 32.1387],
  zoom: 13.5,
  status: "live",
  tagline_he: "9 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.ramathasharon.geo.json",
    demographics: "ramathasharon.demographics.json",
    crime: "ramathasharon.crime.json",
    schools: "ramathasharon.schools.json",
    transit: "ramathasharon.transit.json",
    environment: "ramathasharon.environment.json",
    prices: "ramathasharon.prices.json", // not built yet (Govmap refuses automated requests)
    market: "ramathasharon.market.json",
    pois: "ramathasharon.pois.json",
  },
};


/** Hod HaSharon — 9 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const hodhasharon: City = {
  id: "hodhasharon",
  slug: "hod-hasharon",
  name_he: "הוד השרון",
  name_en: "Hod HaSharon",
  semel: 9700,
  center: [34.8985, 32.1498],
  zoom: 13.4,
  status: "live",
  tagline_he: "9 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.hodhasharon.geo.json",
    demographics: "hodhasharon.demographics.json",
    crime: "hodhasharon.crime.json",
    schools: "hodhasharon.schools.json",
    transit: "hodhasharon.transit.json",
    environment: "hodhasharon.environment.json",
    prices: "hodhasharon.prices.json", // not built yet (Govmap refuses automated requests)
    market: "hodhasharon.market.json",
    pois: "hodhasharon.pois.json",
  },
};


/** Rehovot — 27 neighborhoods. Anchors from the official real-estate site's list;
 *  prices come from its by-size figures (no Govmap prices file). */
const rehovot: City = {
  id: "rehovot",
  slug: "rehovot",
  name_he: "רחובות",
  name_en: "Rehovot",
  semel: 8400,
  center: [34.8020, 31.8930],
  zoom: 13.2,
  status: "live",
  tagline_he: "27 שכונות · נתוני אמת",
  files: {
    geo: "neighborhoods.rehovot.geo.json",
    demographics: "rehovot.demographics.json",
    crime: "rehovot.crime.json",
    schools: "rehovot.schools.json",
    transit: "rehovot.transit.json",
    environment: "rehovot.environment.json",
    prices: "rehovot.prices.json", // not built yet (Govmap refuses automated requests)
    market: "rehovot.market.json",
    pois: "rehovot.pois.json",
  },
};

/** All cities, in display order. */
export const CITIES: City[] = [modiin, oryehuda, rishon, kefarsava, raanana, herzliya, netanya, petahtikva, haifa, jerusalem, ramatgan, givatayim, holon, batyam, beersheva, telaviv, ramathasharon, hodhasharon, rehovot, nyc];

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

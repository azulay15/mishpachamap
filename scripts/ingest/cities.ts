/**
 * City registry for the neighborhood-polygon builder (`build_neighborhoods.ts`).
 *
 * Adding a new city is meant to be cheap: supply its CBS locality code
 * (`semelYishuv`) and one anchor point per neighborhood. The builder does the
 * rest — it pulls the authoritative CBS 2022 statistical-area boundaries for
 * that locality, groups them to the nearest anchor, and clips the result to the
 * built-up footprint from OSM buildings.
 *
 * Why anchors instead of hand-drawn polygons: a statistical area is grouped to
 * whichever neighborhood anchor is closest (a Voronoi assignment). That needs
 * only a single representative lng/lat per neighborhood — which we already have
 * from OSM `place=neighbourhood/suburb` nodes — so no city ever needs polygons
 * drawn by hand. Boundary areas where "nearest anchor" guesses wrong are fixed
 * with a small per-city `statOverrides` map.
 */

export type NeighborhoodAnchor = {
  /** Stable slug — must match the ids used by seed_neighborhoods + the app. */
  id: string;
  name_he: string;
  name_en: string;
  /** Representative point inside the neighborhood (OSM place node, usually). */
  lng: number;
  lat: number;
};

export type CityConfig = {
  /** City slug, e.g. "modiin". */
  id: string;
  /** CBS locality code (סמל יישוב). Modi'in-Maccabim-Re'ut = 1200. */
  semelYishuv: number;
  /** Output path for the generated FeatureCollection, relative to cwd. */
  outFile: string;
  /** One anchor per neighborhood. Order is preserved in the output. */
  anchors: NeighborhoodAnchor[];
  /**
   * Manual fixes for boundary statistical areas the nearest-anchor rule gets
   * wrong. Keyed by STAT_2022 code -> neighborhood id. Keep this small; if it
   * grows large the anchors are probably misplaced.
   */
  statOverrides?: Record<number, string>;
  /** How far to buffer the built-up mask outward, to catch yards/streets. Default 35m. */
  clipBufferMeters?: number;
  /** Concave-hull max edge for the built-up mask; larger bridges bigger gaps. Default 0.18km. */
  concaveMaxEdgeKm?: number;

  // ---- Per-city output filenames + source keys for the data-ingest scripts. ----
  // These MUST match the basenames in lib/cities.ts `files` (the app reads them).
  // Kept here (not imported from lib/) so the ingest scripts stay decoupled from
  // the Next app under tsx.
  /** Output basename (under public/) for demographics.ts. */
  demographicsOut?: string;
  /** Output basename (under public/) for crime.ts. */
  crimeOut?: string;
  /** Output basename (under public/) for schools_moe.ts. */
  schoolsOut?: string;
  /** Output basename (under public/) for transit.ts. */
  transitOut?: string;
  /** Output basename (under public/) for environment.ts (green/quiet). */
  environmentOut?: string;
  /** Output basename (under public/) for prices.ts (Govmap sale metrics). */
  pricesOut?: string;
  /** MoE "שם ישוב" filter value for schools_moe (as stored in the dataset — may be truncated). */
  moeCityName?: string;
  /** GTFS city name for transit.ts (Open Bus Stride spelling: spaces, no hyphens). */
  gtfsCityName?: string;
};

/**
 * Modi'in-Maccabim-Re'ut (semel 1200).
 *
 * Anchors are the OSM `place` node centers for 13 of the 14 neighborhoods
 * (Moreshet has no OSM node yet, so its anchor is a hand-set point inside the
 * new western statistical area 335).
 *
 * statOverrides: three boundary areas whose nearest anchor is a neighbor —
 *   112 sits between HaNechalim and Masuah but belongs to Masuah (Givat C);
 *   114 leans toward HaPrachim but belongs to HaNechalim (Safdie);
 *   334 is a detached northern area assigned to HaNeviim.
 */
const modiin: CityConfig = {
  id: "modiin",
  semelYishuv: 1200,
  outFile: "public/neighborhoods.geo.json",
  anchors: [
    { id: "hanechalim", name_he: "הנחלים", name_en: "HaNechalim", lng: 35.0165, lat: 31.898 },
    { id: "hashvatim", name_he: "השבטים", name_en: "HaShvatim", lng: 35.0046, lat: 31.888 },
    { id: "hareut", name_he: "הרעות", name_en: "HaReut", lng: 35.0181, lat: 31.8869 },
    { id: "nofim", name_he: "נופים", name_en: "Nofim", lng: 34.9848, lat: 31.8967 },
    { id: "avneichen", name_he: "אבני חן", name_en: "Avnei Chen", lng: 34.9965, lat: 31.9035 },
    { id: "hameginim", name_he: "המגינים", name_en: "HaMeginim", lng: 35.0012, lat: 31.9095 },
    { id: "haprachim", name_he: "הפרחים", name_en: "HaPrachim", lng: 35.0112, lat: 31.9049 },
    { id: "hanevim", name_he: "הנביאים", name_en: "HaNeviim", lng: 35.0057, lat: 31.9122 },
    { id: "moriah", name_he: "מוריה", name_en: "Moriah", lng: 35.0067, lat: 31.8823 },
    { id: "hamakkabim", name_he: "המכבים", name_en: "HaMakkabim", lng: 35.034, lat: 31.8921 },
    { id: "hakramim", name_he: "הכרמים", name_en: "HaKramim", lng: 35.0097, lat: 31.9156 },
    { id: "masuah", name_he: "משואה", name_en: "Masuah", lng: 35.008, lat: 31.8947 },
    { id: "hatsiporim", name_he: "הציפורים", name_en: "HaTsiporim", lng: 34.9967, lat: 31.8965 },
    { id: "moreshet", name_he: "מורשת", name_en: "Moreshet", lng: 34.9848, lat: 31.9041 },
  ],
  statOverrides: {
    112: "masuah",
    114: "hanechalim",
    334: "hanevim",
  },
  // Legacy filenames (predate the multi-city convention) — must match lib/cities.ts.
  demographicsOut: "neighborhoods.demographics.json",
  crimeOut: "neighborhoods.crime.json",
  schoolsOut: "schools.modiin.json",
  transitOut: "transit.modiin.json",
  environmentOut: "modiin.environment.json",
  pricesOut: "modiin.prices.json",
  moeCityName: "מודיעין-מכבים-", // truncated locality value in the MoE dataset
  gtfsCityName: "מודיעין מכבים רעות", // GTFS spelling: spaces, no hyphens
};

/**
 * Mevo Modi'im (semel 1141) — a small moshav NW of Modi'in, added as a
 * separate-city POC. Too small for internal neighborhoods: CBS represents the
 * whole settlement as a single statistical area, so it maps to one "neighborhood"
 * covering the moshav. Demonstrates that expanding to another city is just a
 * config entry (a CBS semel code + an anchor) — no code changes.
 */
const mevoModiim: CityConfig = {
  id: "mevomodiim",
  semelYishuv: 1141,
  outFile: "public/neighborhoods.mevomodiim.geo.json",
  anchors: [
    { id: "mevomodiim", name_he: "מבוא מודיעים", name_en: "Mevo Modi'im", lng: 34.9874, lat: 31.9337 },
  ],
};

/**
 * Or Yehuda (semel 2400) — the second full city. Anchors + statOverrides come
 * from a deep investigation against the CBS ArcGIS statistical-areas layer
 * (16 areas for semel 2400: 11–14, 21–27, 31–35) cross-referenced with the
 * municipal zone list, OSM place nodes, and Wikipedia. 8 residential
 * neighborhoods (SA33, the southern industrial zone, is excluded); crosswalk:
 *   sakia 11,12 · ramat-pinkas 13 · neve-savyon 14,21 · kiryat-giora 22,23,24,25
 *   · shchunat-haacademaim 26 · beit-bapark 27 · shchunot-dromiyot 31,32,34
 *   · neve-rabin 35  ·  (SA33 industrial → dropped)
 * Notes: אונו הצעירה is Kiryat Ono (excluded); כפר עאנה is historic (folded into
 * the old core / neve-rabin lands); נווה איילון is still being built and has no
 * 2022 statistical area yet, so it's deferred (not an anchor).
 */
const orYehuda: CityConfig = {
  id: "oryehuda",
  semelYishuv: 2400,
  outFile: "public/neighborhoods.oryehuda.geo.json",
  anchors: [
    { id: "ramat-pinkas", name_he: "רמת פנקס", name_en: "Ramat Pinkas", lng: 34.84098, lat: 32.03464 },
    { id: "neve-savyon", name_he: "נווה סביון", name_en: "Neve Savyon", lng: 34.85684, lat: 32.03238 },
    { id: "shchunat-haacademaim", name_he: "שכונת האקדמאים", name_en: "HaAcademaim", lng: 34.85536, lat: 32.02829 },
    { id: "beit-bapark", name_he: "בית בפארק", name_en: "Beit BaPark", lng: 34.85783, lat: 32.03855 },
    { id: "neve-rabin", name_he: "נווה רבין", name_en: "Neve Rabin", lng: 34.87050, lat: 32.02400 },
    { id: "kiryat-giora", name_he: "קריית גיורא", name_en: "Kiryat Giora", lng: 34.86400, lat: 32.03050 },
    { id: "sakia", name_he: "סקיא", name_en: "Sakia", lng: 34.84950, lat: 32.02980 },
    { id: "shchunot-dromiyot", name_he: "השכונות הדרומיות", name_en: "Southern Neighborhoods", lng: 34.85650, lat: 32.02400 },
  ],
  // Boundary/ambiguous statistical areas the nearest-anchor rule can misassign.
  statOverrides: {
    11: "sakia",
    14: "neve-savyon",
    22: "kiryat-giora",
    25: "kiryat-giora",
    32: "shchunot-dromiyot",
    // SA33 is the southern industrial zone (non-residential). It's routed to a
    // discard id with no matching anchor, so build_neighborhoods drops it from
    // the output rather than inflating a residential neighborhood with it.
    33: "__industrial_discard__",
    34: "shchunot-dromiyot",
  },
  demographicsOut: "oryehuda.demographics.json",
  crimeOut: "oryehuda.crime.json",
  schoolsOut: "oryehuda.schools.json",
  transitOut: "oryehuda.transit.json",
  environmentOut: "oryehuda.environment.json",
  pricesOut: "oryehuda.prices.json",
  moeCityName: "אור יהודה",
  gtfsCityName: "אור יהודה",
};

/**
 * Rishon LeZion (semel 8300) — the third, large city (~252k, 2022). From a deep
 * investigation against the CBS ArcGIS layer (85 statistical areas) + OSM place
 * nodes + Nominatim reverse-geocoding: 34 residential neighborhoods; 3 areas
 * (621/622 New Industrial, 643 far-west coastal void) are discarded. NOTE:
 * "רמב\"ם" carries a literal gershayim — escaped here so the string parses.
 */
const rishonLezion: CityConfig = {
  id: "rishon",
  semelYishuv: 8300,
  outFile: "public/neighborhoods.rishon.geo.json",
  anchors: [
    { id: "rishonim", name_he: "ראשונים", name_en: "Rishonim", lng: 34.80406, lat: 31.9536 },
    { id: "hairisim", name_he: "האירוסים", name_en: "HaIrisim", lng: 34.80458, lat: 31.95096 },
    { id: "abramovich", name_he: "אברמוביץ", name_en: "Abramovich", lng: 34.80143, lat: 31.96883 },
    { id: "katznelson", name_he: "כצנלסון", name_en: "Katznelson", lng: 34.79463, lat: 31.96815 },
    { id: "remez", name_he: "רמז", name_en: "Remez", lng: 34.79543, lat: 31.96047 },
    { id: "neve-hillel", name_he: "נווה הלל", name_en: "Neve Hillel", lng: 34.78997, lat: 31.95969 },
    { id: "bnot-hayil", name_he: "בנות חיל", name_en: "Bnot Hayil", lng: 34.79409, lat: 31.97301 },
    { id: "nahalat-yehuda", name_he: "נחלת יהודה", name_en: "Nahalat Yehuda", lng: 34.80624, lat: 31.98589 },
    { id: "rambam", name_he: "רמב\"ם", name_en: "Rambam", lng: 34.81074, lat: 31.96524 },
    { id: "hashomer", name_he: "השומר", name_en: "HaShomer", lng: 34.81136, lat: 31.96007 },
    { id: "neve-hadarim", name_he: "נווה הדרים", name_en: "Neve Hadarim", lng: 34.81687, lat: 31.95888 },
    { id: "kidmat-rishon", name_he: "קדמת ראשון", name_en: "Kidmat Rishon", lng: 34.81556, lat: 31.97063 },
    { id: "neurim", name_he: "נעורים", name_en: "Neurim", lng: 34.81283, lat: 31.97429 },
    { id: "revivim", name_he: "רביבים", name_en: "Revivim", lng: 34.82234, lat: 31.9659 },
    { id: "marom-rishon", name_he: "מרום ראשון", name_en: "Marom Rishon", lng: 34.82347, lat: 31.96914 },
    { id: "nuriyot", name_he: "נוריות", name_en: "Nuriyot", lng: 34.82945, lat: 31.96548 },
    { id: "narkisim", name_he: "נרקיסים", name_en: "Narkisim", lng: 34.8306, lat: 31.95935 },
    { id: "tzamarot", name_he: "צמרות", name_en: "Tzamarot", lng: 34.82466, lat: 31.95732 },
    { id: "mishor-hanof", name_he: "מישור הנוף", name_en: "Mishor HaNof", lng: 34.81178, lat: 31.95301 },
    { id: "gordon", name_he: "גורדון", name_en: "Gordon", lng: 34.81645, lat: 31.95177 },
    { id: "kalaniyot", name_he: "כלניות", name_en: "Kalaniyot", lng: 34.82165, lat: 31.94538 },
    { id: "shikunei-hamizrah", name_he: "שיכוני המזרח", name_en: "Shikunei HaMizrah", lng: 34.82687, lat: 31.95311 },
    { id: "harakafot", name_he: "הרקפות", name_en: "HaRakafot", lng: 34.82974, lat: 31.94799 },
    { id: "ramat-eliyahu", name_he: "רמת אליהו", name_en: "Ramat Eliyahu", lng: 34.78981, lat: 31.98235 },
    { id: "neve-yam", name_he: "נווה ים", name_en: "Neve Yam", lng: 34.77983, lat: 31.98579 },
    { id: "kiryat-rishon", name_he: "קריית ראשון", name_en: "Kiryat Rishon", lng: 34.78448, lat: 31.97284 },
    { id: "kiryat-kramim", name_he: "קריית כרמים", name_en: "Kiryat Kramim", lng: 34.77907, lat: 31.97415 },
    { id: "kiryat-ganim", name_he: "קרית גנים", name_en: "Kiryat Ganim", lng: 34.77853, lat: 31.9653 },
    { id: "neot-ashalim", name_he: "נאות אשלים", name_en: "Neot Ashalim", lng: 34.77374, lat: 31.96589 },
    { id: "neot-shikma", name_he: "נאות שיקמה", name_en: "Neot Shikma", lng: 34.77196, lat: 31.97746 },
    { id: "neve-dekalim", name_he: "נווה דקלים", name_en: "Neve Dekalim", lng: 34.762, lat: 31.98177 },
    { id: "kiryat-hatanei-pras-nobel", name_he: "קרית חתני פרס נובל", name_en: "Kiryat Hatanei Pras Nobel", lng: 34.76575, lat: 31.97025 },
    { id: "neve-hof", name_he: "נווה חוף", name_en: "Neve Hof", lng: 34.74156, lat: 31.99629 },
    { id: "shaar-hayam", name_he: "שער הים", name_en: "Shaar HaYam", lng: 34.7369, lat: 31.99916 },
  ],
  statOverrides: {
    111: "marom-rishon",
    212: "shikunei-hamizrah", // nearest-anchor gave it to harakafot; research assigns it here
    // Non-residential areas → discard id (no matching anchor → dropped from output).
    621: "__nonresidential_discard__", // New Industrial Area (west)
    622: "__nonresidential_discard__", // New Industrial Area (west)
    643: "__nonresidential_discard__", // far-west coastal/agricultural void (12.9 km²)
  },
  demographicsOut: "rishon.demographics.json",
  crimeOut: "rishon.crime.json",
  schoolsOut: "rishon.schools.json",
  transitOut: "rishon.transit.json",
  environmentOut: "rishon.environment.json",
  pricesOut: "rishon.prices.json",
  moeCityName: "ראשון לציון",
  gtfsCityName: "ראשון לציון",
};

export const CITIES: Record<string, CityConfig> = {
  modiin,
  mevomodiim: mevoModiim,
  oryehuda: orYehuda,
  rishon: rishonLezion,
};

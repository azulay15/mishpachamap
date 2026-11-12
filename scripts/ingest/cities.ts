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

/**
 * Kfar Saba (semel 6900) — 4th city, built via the self-serve flow (scaffold →
 * research agent → build → qa). 32 CBS stat areas → 18 residential neighborhoods;
 * 3 eastern industrial/business-park areas (111/115/116) discarded. Anchors +
 * crosswalk from the municipal neighborhoods map + CBS ArcGIS + OSM. Nearest-
 * anchor Voronoi resolves every residential area cleanly (no boundary overrides).
 * Review flags: SA112 label yoseftal↔givat-eshkol; SA114 ks-tzeira↔gani-sharon.
 */
const kefarsava: CityConfig = {
  id: "kefarsava",
  semelYishuv: 6900,
  outFile: "public/neighborhoods.kefarsava.geo.json",
  anchors: [
    { id: "kaplan", name_he: "קפלן", name_en: "Kaplan", lng: 34.937, lat: 32.18878 },
    { id: "yoseftal", name_he: "יוספטל", name_en: "Yoseftal", lng: 34.94335, lat: 32.18486 },
    { id: "ks-tzeira", name_he: "כפר סבא הצעירה", name_en: "Kfar Saba HaTze'ira", lng: 34.91825, lat: 32.18821 },
    { id: "tzafon", name_he: "צפון", name_en: "Tzafon", lng: 34.914, lat: 32.184 },
    { id: "hadarim", name_he: "הדרים", name_en: "Hadarim", lng: 34.92, lat: 32.179 },
    { id: "hapark", name_he: "הפארק", name_en: "HaPark", lng: 34.916, lat: 32.1765 },
    { id: "merkaz", name_he: "מרכז העיר", name_en: "City Center", lng: 34.9095, lat: 32.179 },
    { id: "eliezer", name_he: "אליעזר", name_en: "Eliezer", lng: 34.905, lat: 32.184 },
    { id: "shikunei-mizrahi", name_he: "שיכוני מזרחי", name_en: "Shikunei Mizrahi", lng: 34.901, lat: 32.178 },
    { id: "sirkin", name_he: "סירקין", name_en: "Sirkin", lng: 34.899, lat: 32.185 },
    { id: "maoz", name_he: "מעוז", name_en: "Maoz", lng: 34.89235, lat: 32.1805 },
    { id: "shikun-aliya", name_he: "שיכון עלייה", name_en: "Shikun Aliya", lng: 34.9, lat: 32.19071 },
    { id: "ks-yeruka", name_he: "כפר סבא הירוקה", name_en: "Green Kfar Saba", lng: 34.893, lat: 32.192 },
    { id: "haprachim", name_he: "הפרחים", name_en: "HaPrachim", lng: 34.896, lat: 32.175 },
    { id: "rishonim", name_he: "ראשונים", name_en: "Rishonim", lng: 34.9025, lat: 32.174 },
    { id: "hapoalim", name_he: "הפועלים", name_en: "HaPoalim", lng: 34.909, lat: 32.172 },
    { id: "nordau", name_he: "נורדאו", name_en: "Nordau", lng: 34.91666, lat: 32.17109 },
    { id: "geulim", name_he: "גאולים", name_en: "Geulim", lng: 34.92364, lat: 32.16856 },
  ],
  statOverrides: {
    111: "__nonresidential_discard__", // Business Park 50 + Abu Snina + industrial (far-NE)
    115: "__nonresidential_discard__", // אזור התעשייה הישן (Old Industrial Zone, Teva)
    116: "__nonresidential_discard__", // Old Industrial Zone + open land to road 55
  },
  demographicsOut: "kefarsava.demographics.json",
  crimeOut: "kefarsava.crime.json",
  schoolsOut: "kefarsava.schools.json",
  transitOut: "kefarsava.transit.json",
  environmentOut: "kefarsava.environment.json",
  pricesOut: "kefarsava.prices.json",
  moeCityName: "כפר סבא",
  gtfsCityName: "כפר סבא",
};

/**
 * Ra'anana (semel 8700) — 15 residential neighborhoods from 27 CBS stat areas.
 * Only 2 discards, both confirmed by CBS's own COD_TIFKUD land-use code:
 * SA11 (=2, industry: the NE hi-tech park + Renanim Mall) and SA41 (=4, open:
 * cemetery + farmland). NOTE the industrial zone is in the NORTH-EAST, not the
 * west — the west is parkland.
 * 10 of 25 residential areas have no OSM place node, so the crosswalk is FULLY
 * explicit rather than nearest-anchor.
 * Review flags: SA26 kfar-batya (84% is parkland — verify the polygon looks
 * sane); SA36 merkaz-darom (SE pocket, no common name found); SA25 also
 * contains שיכון אשר + שכונת 2003; SA23 also contains קריית שז"ר.
 */
const raanana: CityConfig = {
  id: "raanana",
  semelYishuv: 8700,
  outFile: "public/neighborhoods.raanana.geo.json",
  anchors: [
    { id: "kiryat-eliyahu-golomb", name_he: "קריית אליהו גולומב", name_en: "Kiryat Eliyahu Golomb", lng: 34.87588, lat: 32.18847 },
    { id: "lester", name_he: "שכונת לסטר", name_en: "Lester", lng: 34.8854, lat: 32.18155 },
    { id: "kiryat-remez", name_he: "קריית דוד רמז", name_en: "Kiryat David Remez", lng: 34.87651, lat: 32.18261 },
    { id: "kiryat-weizmann", name_he: "קריית וייצמן", name_en: "Kiryat Weizmann", lng: 34.86871, lat: 32.1871 },
    { id: "rasco-ben-tzvi", name_he: "רסקו (קריית בן צבי)", name_en: "Rasco (Kiryat Ben Tzvi)", lng: 34.8738, lat: 32.19521 },
    { id: "amidar", name_he: "עמידר", name_en: "Amidar", lng: 34.86545, lat: 32.1869 },
    { id: "kiryat-ganim", name_he: "קריית גנים", name_en: "Kiryat Ganim", lng: 34.85725, lat: 32.1909 },
    { id: "kfar-batya", name_he: "כפר בתיה", name_en: "Kfar Batya", lng: 34.85151, lat: 32.18992 },
    { id: "rom-2000", name_he: "רום 2000", name_en: "Rom 2000", lng: 34.85531, lat: 32.18373 },
    { id: "merkaz-darom", name_he: "מרכז דרום", name_en: "Merkaz Darom", lng: 34.86605, lat: 32.17889 },
    { id: "ha-mea", name_he: "שכונת המאה", name_en: "HaMe'a", lng: 34.86878, lat: 32.17388 },
    { id: "kiryat-haprachim", name_he: "קריית הפרחים", name_en: "Kiryat HaPrachim", lng: 34.85974, lat: 32.18273 },
    { id: "neve-zemer", name_he: "נווה זמר", name_en: "Neve Zemer", lng: 34.86621, lat: 32.19547 },
    { id: "kiryat-sharett", name_he: "קריית שרת", name_en: "Kiryat Sharett", lng: 34.85638, lat: 32.19582 },
    { id: "lev-hapark", name_he: "לב הפארק", name_en: "Lev HaPark", lng: 34.85003, lat: 32.19445 },
  ],
  // Fully explicit: too many areas lack an OSM anchor for nearest-anchor to be safe.
  statOverrides: {
    11: "__nonresidential_discard__", // COD_TIFKUD=2 — industrial park + Renanim Mall + Country Club
    41: "__nonresidential_discard__", // COD_TIFKUD=4 — cemetery + farmland (16 buildings/km²)
    12: "kiryat-eliyahu-golomb", 13: "kiryat-eliyahu-golomb",
    14: "lester", 15: "lester",
    16: "kiryat-remez", 17: "kiryat-remez", 18: "kiryat-remez", 19: "kiryat-remez",
    21: "kiryat-weizmann", 22: "kiryat-weizmann",
    23: "rasco-ben-tzvi",
    24: "amidar",
    25: "kiryat-ganim",
    26: "kfar-batya",
    31: "rom-2000",
    32: "merkaz-darom", 34: "merkaz-darom", 35: "merkaz-darom", 36: "merkaz-darom",
    33: "ha-mea",
    37: "kiryat-haprachim",
    42: "neve-zemer", 43: "neve-zemer",
    44: "kiryat-sharett",
    45: "lev-hapark",
  },
  demographicsOut: "raanana.demographics.json",
  crimeOut: "raanana.crime.json",
  schoolsOut: "raanana.schools.json",
  transitOut: "raanana.transit.json",
  environmentOut: "raanana.environment.json",
  pricesOut: "raanana.prices.json",
  moeCityName: "רעננה",
  gtfsCityName: "רעננה",
};

/**
 * Herzliya (semel 6400) — 15 residential neighborhoods from 36 CBS stat areas.
 * 8 discards: the hi-tech park (312/315 — zero residential buildings), Reichman
 * University + Herzliya Park (224), the Seven Stars/stadium/cemetery belt (223),
 * Apollonia park (321), and open land (114/313/314).
 * Only 3 genuine boundary corrections (121/131/232).
 * NOTE CBS spells the city הרצלייה (double yod) — match on semel, not name.
 * Review flags: SA232 (merkaz-hair vs nahalat-israel — weakest call); SA221
 * contains BOTH gan-rashal and נחלת עדה (can't split without polygon surgery);
 * SA322 folds the Gali Tchelet cliff streets (culturally Pituach) into nof-yam,
 * which matters for price signals; SA311 marina folded into pituach (flip to
 * discard if CBS shows ~0 population).
 */
const herzliya: CityConfig = {
  id: "herzliya",
  semelYishuv: 6400,
  outFile: "public/neighborhoods.herzliya.geo.json",
  anchors: [
    { id: "herzliya-pituach", name_he: "הרצליה פיתוח", name_en: "Herzliya Pituach", lng: 34.80818, lat: 32.17394 },
    { id: "nof-yam", name_he: "נוף ים", name_en: "Nof Yam", lng: 34.80985, lat: 32.186 },
    { id: "herzliya-bet", name_he: "הרצליה ב'", name_en: "Herzliya Bet", lng: 34.81642, lat: 32.17037 },
    { id: "galil-yam", name_he: "גליל ים", name_en: "Galil Yam", lng: 34.82555, lat: 32.16272 },
    { id: "nahalat-israel", name_he: "נחלת ישראל", name_en: "Nahalat Israel", lng: 34.83415, lat: 32.17112 },
    { id: "shchunat-weizmann", name_he: "שכונת ויצמן", name_en: "Weizmann", lng: 34.83387, lat: 32.16554 },
    { id: "merkaz-hair", name_he: "מרכז העיר", name_en: "City Center", lng: 34.843, lat: 32.166 },
    { id: "herzliya-hayeruka", name_he: "הרצליה הירוקה", name_en: "Herzliya HaYeruka", lng: 34.84556, lat: 32.17441 },
    { id: "gan-rashal", name_he: 'גן רש"ל', name_en: "Gan Rashal", lng: 34.84662, lat: 32.17876 },
    { id: "yad-hatisha", name_he: "יד התשעה", name_en: "Yad HaTisha", lng: 34.85357, lat: 32.17527 },
    { id: "neve-amal", name_he: "נווה עמל", name_en: "Neve Amal", lng: 34.85477, lat: 32.16797 },
    { id: "tsamarot", name_he: "צמרות", name_en: "Tsamarot", lng: 34.84514, lat: 32.15125 },
    { id: "herzliya-hatzeira", name_he: "הרצליה הצעירה", name_en: "Herzliya HaTzeira", lng: 34.84594, lat: 32.15557 },
    { id: "neve-amirim", name_he: "נווה אמירים", name_en: "Neve Amirim", lng: 34.8376, lat: 32.15412 },
    { id: "neve-israel", name_he: "נווה ישראל", name_en: "Neve Israel", lng: 34.83929, lat: 32.15929 },
  ],
  statOverrides: {
    114: "__nonresidential_discard__", // open land + IMI Ramat HaSharon buffer (8 buildings)
    223: "__nonresidential_discard__", // Seven Stars Mall + stadium + old cemetery + farmland
    224: "__nonresidential_discard__", // Reichman University campus + Herzliya Park
    312: "__nonresidential_discard__", // hi-tech park (87 buildings, ZERO residential)
    313: "__nonresidential_discard__", // Sira-interchange commercial strip
    314: "__nonresidential_discard__", // open land / Glilot buffer (3 buildings)
    315: "__nonresidential_discard__", // industrial core (39 buildings, ZERO residential)
    321: "__nonresidential_discard__", // Apollonia national park + sealed IMI site
    121: "tsamarot", // contains both the צמרות and שיכון דרום nodes; towers = Tsamarot
    131: "merkaz-hair", // dense old Moshava core
    232: "merkaz-hair", // ⚠ nearest-anchor wants nahalat-israel — REVIEW
  },
  demographicsOut: "herzliya.demographics.json",
  crimeOut: "herzliya.crime.json",
  schoolsOut: "herzliya.schools.json",
  transitOut: "herzliya.transit.json",
  environmentOut: "herzliya.environment.json",
  pricesOut: "herzliya.prices.json",
  moeCityName: "הרצליה",
  gtfsCityName: "הרצליה",
};

/**
 * Netanya (semel 7400) — 27 residential neighborhoods from 73 CBS stat areas.
 * 8 discards totalling 10.2 km² (33% of the city!) — two large employment zones
 * (א.ת. פולג 2.52 km², א.ת. נתניה 2.19 km²), Wingate + בה"ד 8 + the Poleg
 * reserve, the cemetery, and farmland. Expect visible holes east and south;
 * that is correct, not a build bug.
 * The neighborhood roster is the MUNICIPALITY's own list (netanya.muni.il +
 * the muni open-data file), not just OSM/Wikipedia.
 * Review flags: SA432 (ramat-yadin vs agamim — weakest call); the three
 * merkaz-ha'ir splits (311/312/313 could flip); SA513 neot-golda may belong to
 * kiryat-nordau (the muni doesn't list it separately).
 */
const netanya: CityConfig = {
  id: "netanya",
  semelYishuv: 7400,
  outFile: "public/neighborhoods.netanya.geo.json",
  anchors: [
    { id: "ein-hatchelet", name_he: "עין התכלת", name_en: "Ein HaTchelet", lng: 34.860677, lat: 32.350288 },
    { id: "kiryat-sanz", name_he: "קריית צאנז", name_en: "Kiryat Sanz", lng: 34.856438, lat: 32.343954 },
    { id: "pardes-hagdud", name_he: "פרדס הגדוד", name_en: "Pardes HaGdud", lng: 34.866428, lat: 32.343448 },
    { id: "kokhav-hatzafon", name_he: "כוכב הצפון", name_en: "Kokhav HaTzafon", lng: 34.871587, lat: 32.340466 },
    { id: "neot-herzl", name_he: "נאות הרצל", name_en: "Neot Herzl", lng: 34.868679, lat: 32.335261 },
    { id: "merkaz-hair-tzafon-maarav", name_he: "מרכז העיר צפון-מערב", name_en: "City Center North-West", lng: 34.851918, lat: 32.336129 },
    { id: "merkaz-hair-tzafon-mizrach", name_he: "מרכז העיר צפון-מזרח", name_en: "City Center North-East", lng: 34.862965, lat: 32.336608 },
    { id: "merkaz-hair-darom", name_he: "מרכז העיר דרום", name_en: "City Center South", lng: 34.854123, lat: 32.322844 },
    { id: "neve-itamar", name_he: "נווה איתמר", name_en: "Neve Itamar", lng: 34.87468, lat: 32.32658 },
    { id: "ramat-efraim", name_he: "רמת אפרים", name_en: "Ramat Efraim", lng: 34.864174, lat: 32.324062 },
    { id: "neot-ganim", name_he: "נאות גנים", name_en: "Neot Ganim", lng: 34.886703, lat: 32.315237 },
    { id: "ben-zion", name_he: "בן ציון", name_en: "Ben Zion", lng: 34.861027, lat: 32.314707 },
    { id: "nof-hatayelet", name_he: "נוף הטיילת", name_en: "Nof HaTayelet", lng: 34.849827, lat: 32.316121 },
    { id: "ramat-hen", name_he: "רמת חן", name_en: "Ramat Chen", lng: 34.858118, lat: 32.31039 },
    { id: "mishkenot-zevulun", name_he: "משכנות זבולון", name_en: "Mishkenot Zevulun", lng: 34.878845, lat: 32.309351 },
    { id: "ofek-hayam", name_he: "אופק הים", name_en: "Ofek HaYam", lng: 34.850788, lat: 32.307777 },
    { id: "kiryat-rabin", name_he: "קריית רבין", name_en: "Kiryat Rabin", lng: 34.882513, lat: 32.30555 },
    { id: "kiryat-hasharon", name_he: "קריית השרון", name_en: "Kiryat HaSharon", lng: 34.87567, lat: 32.30321 },
    { id: "galei-yam", name_he: "גלי ים", name_en: "Galei Yam", lng: 34.843545, lat: 32.303542 },
    { id: "ramat-yadin", name_he: "רמת ידין (דורה)", name_en: "Ramat Yadin (Dora)", lng: 34.857019, lat: 32.297388 },
    { id: "neot-shaked", name_he: "נאות שקד", name_en: "Neot Shaked", lng: 34.85056, lat: 32.295847 },
    { id: "agamim", name_he: "אגמים", name_en: "Agamim", lng: 34.848222, lat: 32.290432 },
    { id: "givat-hairusim", name_he: "גבעת האירוסים", name_en: "Givat HaIrusim", lng: 34.847849, lat: 32.286178 },
    { id: "kiryat-nordau", name_he: "קריית נורדאו", name_en: "Kiryat Nordau", lng: 34.856102, lat: 32.283953 },
    { id: "ir-yamim", name_he: "עיר ימים", name_en: "Ir Yamim", lng: 34.84325, lat: 32.2789 },
    { id: "neot-golda", name_he: "נאות גולדה", name_en: "Neot Golda", lng: 34.853034, lat: 32.277115 },
    { id: "ramat-poleg", name_he: "רמת פולג", name_en: "Ramat Poleg", lng: 34.845761, lat: 32.272636 },
  ],
  statOverrides: {
    121: "__nonresidential_discard__", // אזור התעשייה פולג + Grand Netter + stadium
    122: "__nonresidential_discard__", // open land / Poleg ravine (8 buildings)
    123: "__nonresidential_discard__", // אזור התעשייה נתניה / קריית ספיר + rail station
    141: "__nonresidential_discard__", // city cemetery + farmland (2 buildings)
    146: "__nonresidential_discard__", // farmland east of Kiryat HaSharon (2 buildings)
    415: "__nonresidential_discard__", // שמורת האירוסים + beach + old landfill (0 buildings)
    536: "__nonresidential_discard__", // מכון וינגייט + בה"ד 8 + שמורת נחל פולג
    624: "__nonresidential_discard__", // open land east of Ramat Chen (5 buildings)
    133: "kiryat-hasharon", // park inside the neighborhood — keep for continuity
    134: "kiryat-hasharon",
    136: "kiryat-hasharon",
    211: "neot-herzl",
    213: "kokhav-hatzafon",
    312: "merkaz-hair-tzafon-maarav",
    311: "merkaz-hair-tzafon-mizrach", // diamond district + שוק נתניה
    313: "merkaz-hair-tzafon-mizrach",
    324: "merkaz-hair-darom",
    325: "merkaz-hair-darom",
    413: "galei-yam", // OSM's oversized Neot Shaked polygon bleeds here
    432: "ramat-yadin", // ⚠ WEAKEST CALL — OSM Agamim covers 52% of it
    513: "neot-golda", // muni folds this into kiryat-nordau — REVIEW
    535: "ir-yamim",
    633: "ofek-hayam",
  },
  demographicsOut: "netanya.demographics.json",
  crimeOut: "netanya.crime.json",
  schoolsOut: "netanya.schools.json",
  transitOut: "netanya.transit.json",
  environmentOut: "netanya.environment.json",
  pricesOut: "netanya.prices.json",
  moeCityName: "נתניה",
  gtfsCityName: "נתניה",
};

/**
 * Petah Tikva (semel 7900, ~272k) — 29 residential neighborhoods from 81 CBS
 * stat areas, the largest city in the app.
 * 8 discards totalling 17.4 km² (49% of the land, almost none of the housing):
 * Segula + Kiryat Arye industrial zones, Ramat Siv business park, Yarkon open
 * land, farmland. CBS's COD_TIFKUD confirmed each (2=employment, 4=open).
 * Traps: יוספטל collides with a Hadera suburb (renamed פסגת אלון here);
 * האחים ישראלית is a STREET, not a neighborhood.
 * Review flags: SA431 (kiryat-elazar vs kfar-avraham vs yoseftal — MOST
 * ambiguous); SA628 (kiryat-matalon but not contiguous with it); SA716, SA233,
 * SA415, SA722, SA524, SA222. Also: OSM has combined-name quarter polygons
 * suggesting yoseftal+kiryat-alon+kiryat-elazar may be ONE unit.
 */
const petahTikva: CityConfig = {
  id: "petahtikva",
  semelYishuv: 7900,
  outFile: "public/neighborhoods.petahtikva.geo.json",
  anchors: [
    { id: "em-hamoshavot-hadasha", name_he: "אם המושבות החדשה", name_en: "Em HaMoshavot HaHadasha", lng: 34.87896, lat: 32.10294 },
    { id: "em-hamoshavot-vatika", name_he: "אם המושבות הוותיקה", name_en: "Em HaMoshavot HaVatika", lng: 34.87349, lat: 32.103 },
    { id: "neve-gan", name_he: "נווה גן", name_en: "Neve Gan", lng: 34.87445, lat: 32.09347 },
    { id: "shifer-neve-dekalim", name_he: "שיפר / נווה דקלים", name_en: "Shifer / Neve Dekalim", lng: 34.89138, lat: 32.09694 },
    { id: "neve-maoz", name_he: "נווה מעוז", name_en: "Neve Ma'oz", lng: 34.89042, lat: 32.09923 },
    { id: "krol", name_he: "קרול", name_en: "Krol", lng: 34.88368, lat: 32.09543 },
    { id: "chen-hatzafon", name_he: "חן הצפון", name_en: "Chen HaTzafon", lng: 34.89945, lat: 32.1021 },
    { id: "kfar-avraham", name_he: "כפר אברהם", name_en: "Kfar Avraham", lng: 34.89923, lat: 32.09464 },
    { id: "lev-hamoshava", name_he: "לב המושבה", name_en: "Lev HaMoshava", lng: 34.88421, lat: 32.08843 },
    { id: "merkaz-hashaket", name_he: "המרכז השקט", name_en: "HaMerkaz HaShaket", lng: 34.88575, lat: 32.08034 },
    { id: "ein-ganim", name_he: "עין גנים", name_en: "Ein Ganim", lng: 34.89454, lat: 32.08787 },
    { id: "mahane-yehuda", name_he: "מחנה יהודה", name_en: "Mahane Yehuda", lng: 34.89406, lat: 32.08113 },
    { id: "shaariya", name_he: "שעריה", name_en: "Sha'ariya", lng: 34.89982, lat: 32.07595 },
    { id: "ahdut", name_he: "אחדות", name_en: "Ahdut", lng: 34.89238, lat: 32.07378 },
    { id: "kiryat-elazar", name_he: "קריית אלעזר", name_en: "Kiryat Elazar", lng: 34.90498, lat: 32.08467 },
    { id: "kiryat-alon", name_he: "קריית אלון", name_en: "Kiryat Alon", lng: 34.90498, lat: 32.08906 },
    { id: "pisgat-alon-yoseftal", name_he: "פסגת אלון (יוספטל)", name_en: "Pisgat Alon (Yoseftal)", lng: 34.9042, lat: 32.09246 },
    { id: "beilinson", name_he: "בילינסון", name_en: "Beilinson", lng: 34.9173, lat: 32.08044 },
    { id: "hadar-ganim", name_he: "הדר גנים", name_en: "Hadar Ganim", lng: 34.90823, lat: 32.07545 },
    { id: "amishav", name_he: "עמישב", name_en: "Amishav", lng: 34.91218, lat: 32.07522 },
    { id: "kfar-ganim-alef", name_he: "כפר גנים א'", name_en: "Kfar Ganim Alef", lng: 34.87541, lat: 32.08121 },
    { id: "kfar-ganim-bet", name_he: "כפר גנים ב'", name_en: "Kfar Ganim Bet", lng: 34.87915, lat: 32.07691 },
    { id: "kfar-ganim-gimel", name_he: "כפר גנים ג'", name_en: "Kfar Ganim Gimel", lng: 34.87026, lat: 32.07481 },
    { id: "bat-ganim", name_he: "בת גנים", name_en: "Bat Ganim", lng: 34.88091, lat: 32.07278 },
    { id: "ramat-verber", name_he: "רמת ורבר", name_en: "Ramat Verber", lng: 34.87361, lat: 32.08686 },
    { id: "bar-yehuda", name_he: "בר יהודה", name_en: "Bar Yehuda", lng: 34.8702, lat: 32.08346 },
    { id: "neve-ganim", name_he: "נווה גנים", name_en: "Neve Ganim", lng: 34.86668, lat: 32.08579 },
    { id: "neve-oz", name_he: "נווה עוז", name_en: "Neve Oz", lng: 34.86601, lat: 32.07886 },
    { id: "kiryat-matalon", name_he: "קריית מטלון", name_en: "Kiryat Matalon", lng: 34.84995, lat: 32.09026 },
  ],
  statOverrides: {
    111: "__nonresidential_discard__", // Segula industrial zone (TIFKUD 2)
    416: "__nonresidential_discard__", // open farmland S of Kvish Makabit (TIFKUD 4)
    516: "__nonresidential_discard__", // open land, far east (TIFKUD 4, 2.38 km²)
    518: "__nonresidential_discard__", // Yarkon open land + Baptist Village (TIFKUD 4)
    623: "__nonresidential_discard__", // 8.59 km² N belt: Kiryat Arye + Ofer Park + cemetery
    624: "__nonresidential_discard__", // Kiryat Arye industrial (TIFKUD 2)
    625: "__nonresidential_discard__", // Kiryat Arye industrial west (TIFKUD 2)
    627: "__nonresidential_discard__", // Ramat Siv business park (TIFKUD 2)
    716: "kfar-ganim-alef", // ⚠ CBS puts it in Ramat Verber; streets say Kfar Ganim A
    233: "bat-ganim", // ⚠ alt: kfar-ganim-bet
    431: "kiryat-elazar", // ⚠ MOST AMBIGUOUS — streets split 2 Elazar / 2 Yoseftal / 1 Alon
    415: "ahdut", // ⚠ Nominatim says Kiryat Elazar but that OSM polygon is oversized
    628: "kiryat-matalon", // ⚠ real housing but NOT contiguous with Kiryat Matalon
    722: "ramat-verber", // ⚠ CBS TAT 72 (Neve Oz group) but distance says Ramat Verber
    524: "amishav", // ⚠ contains both עמישב and הדר גנים nodes
    222: "merkaz-hashaket", // ⚠ nearest node is Kfar Ganim A; kept in centre per CBS TAT 22
  },
  demographicsOut: "petahtikva.demographics.json",
  crimeOut: "petahtikva.crime.json",
  schoolsOut: "petahtikva.schools.json",
  transitOut: "petahtikva.transit.json",
  environmentOut: "petahtikva.environment.json",
  pricesOut: "petahtikva.prices.json",
  moeCityName: "פתח תקווה",
  gtfsCityName: "פתח תקווה",
};

/**
 * Haifa (semel 4000, ~290k) — 40 residential neighborhoods from 106 CBS stat
 * areas (88 used, 18 discarded).
 * Roster = the MUNICIPALITY's own neighborhood layer (opendata.haifa.muni.il
 * "שכונות העיר", 76 polygons, which nests exactly inside the CBS stat areas —
 * every SA sits 100% inside one municipal neighborhood). Its ~60 residential
 * units are grouped within the municipality's own תת-רובע where they're tiny
 * or share one SA, e.g. קריית אליהו into קריית אליעזר, רמת הדר into מרכז הכרמל.
 * Every SA is listed in statOverrides, so no SA is placed by nearest-anchor.
 * 18 discards (COD_TIFKUD 2/4/5/6 + no census population): the whole Haifa Bay
 * industrial belt (port, refineries, Kishon, Checkpost), MATAM, the Technion
 * and University campuses, the Carmel beach strip, cemeteries, open land.
 * Expect a large hole north-east of downtown; that's the bay industry, not a bug.
 * Census rows CBS publishes combined (e.g. 713 = 713+221+222+223) keep their
 * residential member intact; only the non-residential members are discarded.
 * Review flags: hfa-downtown includes SA321 (Kiryat HaMemshala, the government
 * complex) only so 311 and 322 stay one polygon; hfa-carmel-west folds in
 * כבירים (SA525); hfa-abbas pairs Abbas with Masada (same תת-רובע 61).
 */
const haifa: CityConfig = {
  id: "haifa",
  semelYishuv: 4000,
  outFile: "public/neighborhoods.haifa.geo.json",
  anchors: [
    { id: "hfa-kiryat-shmuel", name_he: "קריית שמואל", name_en: "Kiryat Shmuel", lng: 35.06983, lat: 32.83731 },
    { id: "hfa-kiryat-haim-west", name_he: "קריית חיים מערבית", name_en: "Kiryat Haim West", lng: 35.06196, lat: 32.83286 },
    { id: "hfa-kiryat-haim-east", name_he: "קריית חיים מזרחית", name_en: "Kiryat Haim East", lng: 35.07425, lat: 32.82321 },
    { id: "hfa-downtown", name_he: "העיר התחתית", name_en: "Downtown", lng: 35.00426, lat: 32.81038 },
    { id: "hfa-wadi-nisnas", name_he: "ואדי ניסנאס", name_en: "Wadi Nisnas", lng: 34.99463, lat: 32.81736 },
    { id: "hfa-german-colony", name_he: "המושבה הגרמנית", name_en: "German Colony", lng: 34.98943, lat: 32.82122 },
    { id: "hfa-kiryat-eliezer", name_he: "קריית אליעזר וקריית אליהו", name_en: "Kiryat Eliezer & Kiryat Eliyahu", lng: 34.98032, lat: 32.82492 },
    { id: "hfa-bat-galim", name_he: "בת גלים", name_en: "Bat Galim", lng: 34.98328, lat: 32.83386 },
    { id: "hfa-kiryat-sprinzak", name_he: "קריית שפרינצק ועין הים", name_en: "Kiryat Sprinzak & Ein HaYam", lng: 34.96324, lat: 32.82131 },
    { id: "hfa-shaar-haaliya", name_he: "שער העלייה", name_en: "Sha'ar HaAliya", lng: 34.95736, lat: 32.81907 },
    { id: "hfa-neve-david", name_he: "נווה דוד ורמת הנשיא", name_en: "Neve David & Ramat HaNasi", lng: 34.96004, lat: 32.81107 },
    { id: "hfa-neot-peres", name_he: "נאות פרס", name_en: "Neot Peres", lng: 34.96692, lat: 32.77825 },
    { id: "hfa-carmelia", name_he: "כרמליה ושמבור", name_en: "Carmelia & Shambur", lng: 34.98236, lat: 32.79516 },
    { id: "hfa-vardia", name_he: 'ורדיה ונעמ"ת', name_en: "Vardia & Na'amat", lng: 34.99342, lat: 32.79518 },
    { id: "hfa-merkaz-hacarmel", name_he: "מרכז הכרמל", name_en: "Merkaz HaCarmel", lng: 34.98888, lat: 32.80175 },
    { id: "hfa-carmel-west", name_he: "הכרמל המערבי וכבירים", name_en: "Western Carmel & Kabirim", lng: 34.97719, lat: 32.80578 },
    { id: "hfa-kababir", name_he: "כבאביר", name_en: "Kababir", lng: 34.97055, lat: 32.80444 },
    { id: "hfa-ramat-shaul", name_he: "רמת שאול", name_en: "Ramat Shaul", lng: 34.96938, lat: 32.82285 },
    { id: "hfa-french-carmel", name_he: "הכרמל הצרפתי", name_en: "French Carmel", lng: 34.97549, lat: 32.82083 },
    { id: "hfa-ramat-hatishbi", name_he: "רמת התשבי", name_en: "Ramat HaTishbi", lng: 34.98273, lat: 32.8112 },
    { id: "hfa-abbas", name_he: "עבאס ומסדה", name_en: "Abbas & Masada", lng: 34.98862, lat: 32.81361 },
    { id: "hfa-hadar-elyon", name_he: "הדר עליון", name_en: "Upper Hadar", lng: 34.99468, lat: 32.80545 },
    { id: "hfa-hadar-merkaz", name_he: "הדר מרכז", name_en: "Central Hadar", lng: 34.99707, lat: 32.81128 },
    { id: "hfa-geula", name_he: 'גאולה ויל"ג', name_en: "Geula & Yalag", lng: 35.00256, lat: 32.80406 },
    { id: "hfa-ramat-vizhnitz", name_he: "רמת ויז'ניץ", name_en: "Ramat Vizhnitz", lng: 35.00232, lat: 32.7989 },
    { id: "hfa-halisa", name_he: "חליסה ותל עמל", name_en: "Halisa & Tel Amal", lng: 35.01221, lat: 32.79841 },
    { id: "hfa-neve-paz", name_he: "נווה פז", name_en: "Neve Paz", lng: 35.02106, lat: 32.79342 },
    { id: "hfa-neve-yosef", name_he: "נווה יוסף", name_en: "Neve Yosef", lng: 35.02023, lat: 32.79112 },
    { id: "hfa-neve-shaanan", name_he: "נווה שאנן", name_en: "Neve Sha'anan", lng: 35.02374, lat: 32.78453 },
    { id: "hfa-yizreelia", name_he: "יזרעאליה", name_en: "Yizre'elia", lng: 35.00991, lat: 32.79231 },
    { id: "hfa-ziv", name_he: "זיו", name_en: "Ziv", lng: 35.01467, lat: 32.78368 },
    { id: "hfa-ramat-alon", name_he: "רמת אלון", name_en: "Ramat Alon", lng: 35.01302, lat: 32.7748 },
    { id: "hfa-ramot-remez", name_he: "רמות רמז", name_en: "Ramot Remez", lng: 35.0099, lat: 32.77952 },
    { id: "hfa-ramat-sapir", name_he: "רמת ספיר ורמת חן", name_en: "Ramat Sapir & Ramat Hen", lng: 35.00495, lat: 32.7869 },
    { id: "hfa-romema", name_he: "רוממה", name_en: "Romema", lng: 34.99656, lat: 32.78921 },
    { id: "hfa-ahuza", name_he: "אחוזה", name_en: "Ahuza", lng: 34.99062, lat: 32.78493 },
    { id: "hfa-ramat-begin", name_he: "רמת בגין ורמת אשכול", name_en: "Ramat Begin & Ramat Eshkol", lng: 34.98201, lat: 32.77644 },
    { id: "hfa-ramat-golda", name_he: "רמת גולדה ורמת אלמוגי", name_en: "Ramat Golda & Ramat Almogi", lng: 35.00494, lat: 32.77385 },
    { id: "hfa-savyonei-hacarmel", name_he: "סביוני הכרמל", name_en: "Savyonei HaCarmel", lng: 35.01219, lat: 32.76972 },
    { id: "hfa-hod-hacarmel", name_he: "הוד הכרמל (דניה)", name_en: "Hod HaCarmel (Denya)", lng: 34.99145, lat: 32.7636 },
  ],
  // Fully explicit (every STAT_2022 listed): neighborhoods follow the municipal
  // list, not nearest-anchor.
  statOverrides: {
    123: "__nonresidential_discard__", // COD_TIFKUD=2 — חוות המיכלים (fuel tank farm)
    124: "__nonresidential_discard__", // =6 — Kiryat Haim stadium
    211: "__nonresidential_discard__", // =2 — Haifa Bay industrial zone
    212: "__nonresidential_discard__", // =2 — Haifa Bay industrial zone
    213: "__nonresidential_discard__", // =2 — Haifa Bay industrial zone
    214: "__nonresidential_discard__", // =2 — oil refineries (בז"ן)
    221: "__nonresidential_discard__", // =2 — sewage works
    222: "__nonresidential_discard__", // =2 — Checkpost / Shemen beach industrial
    223: "__nonresidential_discard__", // =2 — Shemen beach industrial
    231: "__nonresidential_discard__", // =2 — Kishon port + industry
    232: "__nonresidential_discard__", // =2 — Haifa port
    431: "__nonresidential_discard__", // =6 — Carmel beach strip + hotels
    432: "__nonresidential_discard__", // =2 — MATAM hi-tech park
    434: "__nonresidential_discard__", // =6 — cemeteries
    435: "__nonresidential_discard__", // =4 — open land by Neot Peres
    812: "__nonresidential_discard__", // =5 — Technion campus
    825: "__nonresidential_discard__", // =4 — Givat Zemer open land
    945: "__nonresidential_discard__", // =6 — University of Haifa campus
    111: "hfa-kiryat-shmuel", 112: "hfa-kiryat-shmuel",
    121: "hfa-kiryat-haim-west", 122: "hfa-kiryat-haim-west",
    131: "hfa-kiryat-haim-east", 132: "hfa-kiryat-haim-east", 133: "hfa-kiryat-haim-east", 134: "hfa-kiryat-haim-east", 135: "hfa-kiryat-haim-east",
    311: "hfa-downtown", 321: "hfa-downtown", 322: "hfa-downtown",
    331: "hfa-wadi-nisnas", 332: "hfa-wadi-nisnas", 333: "hfa-wadi-nisnas",
    334: "hfa-german-colony",
    411: "hfa-kiryat-eliezer", 412: "hfa-kiryat-eliezer", 413: "hfa-kiryat-eliezer", 414: "hfa-kiryat-eliezer",
    415: "hfa-bat-galim", 416: "hfa-bat-galim", 417: "hfa-bat-galim",
    421: "hfa-kiryat-sprinzak", 422: "hfa-kiryat-sprinzak", 423: "hfa-kiryat-sprinzak",
    424: "hfa-shaar-haaliya",
    425: "hfa-neve-david", 426: "hfa-neve-david",
    433: "hfa-neot-peres",
    511: "hfa-carmelia", 512: "hfa-carmelia",
    513: "hfa-vardia", 514: "hfa-vardia",
    521: "hfa-merkaz-hacarmel", 522: "hfa-merkaz-hacarmel", 523: "hfa-merkaz-hacarmel", 524: "hfa-merkaz-hacarmel",
    525: "hfa-carmel-west", 526: "hfa-carmel-west", 528: "hfa-carmel-west",
    527: "hfa-kababir",
    531: "hfa-ramat-shaul",
    532: "hfa-french-carmel",
    533: "hfa-ramat-hatishbi",
    611: "hfa-abbas", 612: "hfa-abbas", 613: "hfa-abbas",
    621: "hfa-hadar-elyon", 622: "hfa-hadar-elyon", 623: "hfa-hadar-elyon",
    631: "hfa-hadar-merkaz", 632: "hfa-hadar-merkaz", 633: "hfa-hadar-merkaz", 634: "hfa-hadar-merkaz",
    641: "hfa-geula", 642: "hfa-geula",
    643: "hfa-ramat-vizhnitz", 644: "hfa-ramat-vizhnitz",
    711: "hfa-halisa", 712: "hfa-halisa",
    713: "hfa-neve-paz",
    714: "hfa-neve-yosef", 715: "hfa-neve-yosef",
    721: "hfa-neve-shaanan", 722: "hfa-neve-shaanan", 723: "hfa-neve-shaanan",
    731: "hfa-yizreelia", 732: "hfa-yizreelia", 733: "hfa-yizreelia",
    811: "hfa-ziv",
    813: "hfa-ramat-alon",
    821: "hfa-ramot-remez", 822: "hfa-ramot-remez",
    823: "hfa-ramat-sapir", 824: "hfa-ramat-sapir",
    911: "hfa-romema", 912: "hfa-romema",
    921: "hfa-ahuza", 922: "hfa-ahuza", 933: "hfa-ahuza", 934: "hfa-ahuza",
    931: "hfa-ramat-begin", 932: "hfa-ramat-begin",
    941: "hfa-ramat-golda", 942: "hfa-ramat-golda",
    943: "hfa-savyonei-hacarmel",
    944: "hfa-hod-hacarmel",
  },
  demographicsOut: "haifa.demographics.json",
  crimeOut: "haifa.crime.json",
  schoolsOut: "haifa.schools.json",
  transitOut: "haifa.transit.json",
  environmentOut: "haifa.environment.json",
  pricesOut: "haifa.prices.json",
  moeCityName: "חיפה",
  gtfsCityName: "חיפה",
};

/**
 * Jerusalem (semel 3000, ~982k) — 66 residential neighborhoods from 243 CBS
 * stat areas (218 used, 25 discarded). By far the largest city in the app.
 * Roster = the Jerusalem Transportation Masterplan Team's municipal neighborhood
 * layer (ArcGIS "שכונות ירושלים", 115 polygons, JTMT) cross-checked against
 * OSM place nodes and the CBS רובע/תת-רובע codes. Each SA went to the
 * neighborhood it overlaps most (boundary calls flagged below); tiny units are
 * grouped (e.g. the Mea She'arim courtyards, Nachlaot + Mahane Yehuda). Every SA
 * is listed in statOverrides.
 * CENSUS CONSTRAINT: CBS publishes many 2022 census rows only for COMBINED
 * areas (StatAreaCmb, e.g. 2123 = 2121-2126, ~51k people). A combined row is
 * kept inside ONE neighborhood so population, and therefore crime per 1,000
 * residents, isn't attributed to the wrong place. That sets the granularity in
 * the east: Beit Hanina, Shu'fat, Sur Baher etc. are each a single unit.
 * One deliberate exception: SA1332 (Yemin Moshe + Mt Zion) sits with Talbiyeh,
 * where it physically belongs, though its few residents are counted inside
 * census row 1336 (Abu Tor).
 * East Jerusalem: every residential SA inside the municipal boundary that the
 * census covers is included (Kafr Aqab and the Shu'fat camp area too), with
 * names from the municipal list. Police / price / school coverage there is
 * expected to be thin; empty layers stay empty.
 * 25 discards (COD_TIFKUD 2/4/5/6 + no census row): Har Hotzvim, Atarot,
 * Talpiot and Givat Shaul industry, Kiryat HaLeom, the Givat Ram, Mt Scopus and
 * Hadassah campuses, Yad Vashem + Mt Herzl, Malha mall, forest and open land.
 * Review flags: SA1611 Givat HaMatos and SA1813 Arnona Hills were open land in
 * 2022 and are being built now (discarded); SA1025 (Kiryat HaLeom's small
 * residential pocket) sits in jlm-nachlaot; SA1337 (North Talpiot 40% / Abu Tor
 * 41%, ~900 people) sits in jlm-talpiot; jlm-abu-tor joins CBS's two Abu Tor
 * areas (1336 + 2612), as the municipal list does.
 */
const jerusalem: CityConfig = {
  id: "jerusalem",
  semelYishuv: 3000,
  outFile: "public/neighborhoods.jerusalem.geo.json",
  anchors: [
    { id: "jlm-neve-yaakov", name_he: "נווה יעקב", name_en: "Neve Ya'akov", lng: 35.24364, lat: 31.8407 },
    { id: "jlm-pisgat-zeev", name_he: "פסגת זאב", name_en: "Pisgat Ze'ev", lng: 35.25142, lat: 31.82689 },
    { id: "jlm-ramot", name_he: "רמות", name_en: "Ramot", lng: 35.19566, lat: 31.81906 },
    { id: "jlm-tel-arza", name_he: "תל ארזה ועזרת תורה", name_en: "Tel Arza & Ezrat Torah", lng: 35.21469, lat: 31.79596 },
    { id: "jlm-sanhedria", name_he: "סנהדריה", name_en: "Sanhedria", lng: 35.21901, lat: 31.80022 },
    { id: "jlm-ramat-eshkol", name_he: "רמת אשכול וגבעת המבתר", name_en: "Ramat Eshkol & Givat HaMivtar", lng: 35.22594, lat: 31.80134 },
    { id: "jlm-maalot-dafna", name_he: "מעלות דפנה ושמואל הנביא", name_en: "Ma'alot Dafna & Shmuel HaNavi", lng: 35.22594, lat: 31.79502 },
    { id: "jlm-french-hill", name_he: "הגבעה הצרפתית", name_en: "French Hill", lng: 35.23789, lat: 31.8027 },
    { id: "jlm-ramat-shlomo", name_he: "רמת שלמה", name_en: "Ramat Shlomo", lng: 35.21868, lat: 31.81128 },
    { id: "jlm-bukharim", name_he: "שכונת הבוכרים", name_en: "Bukharim Quarter", lng: 35.21957, lat: 31.7928 },
    { id: "jlm-kerem-avraham", name_he: "כרם אברהם", name_en: "Kerem Avraham", lng: 35.21667, lat: 31.79095 },
    { id: "jlm-geula", name_he: "גאולה וזכרון משה", name_en: "Geula & Zikhron Moshe", lng: 35.21692, lat: 31.78777 },
    { id: "jlm-beit-israel", name_he: "בית ישראל", name_en: "Beit Yisrael", lng: 35.22288, lat: 31.78929 },
    { id: "jlm-mea-shearim", name_he: "מאה שערים", name_en: "Mea She'arim", lng: 35.22199, lat: 31.78641 },
    { id: "jlm-mekor-baruch", name_he: "מקור ברוך", name_en: "Mekor Baruch", lng: 35.2111, lat: 31.78904 },
    { id: "jlm-kiryat-sanz", name_he: "קריית צאנז, בעלז ואונסדורף", name_en: "Kiryat Sanz, Belz & Unsdorf", lng: 35.20583, lat: 31.79614 },
    { id: "jlm-romema", name_he: "רוממה", name_en: "Romema", lng: 35.20304, lat: 31.79295 },
    { id: "jlm-beit-hakerem", name_he: "בית הכרם", name_en: "Beit HaKerem", lng: 35.18888, lat: 31.77769 },
    { id: "jlm-nayot", name_he: "ניות", name_en: "Nayot", lng: 35.20466, lat: 31.77085 },
    { id: "jlm-kiryat-moshe", name_he: "קריית משה", name_en: "Kiryat Moshe", lng: 35.19551, lat: 31.78676 },
    { id: "jlm-ein-kerem", name_he: "עין כרם", name_en: "Ein Kerem", lng: 35.15801, lat: 31.76568 },
    { id: "jlm-kiryat-hayovel", name_he: "קריית היובל", name_en: "Kiryat HaYovel", lng: 35.17608, lat: 31.76278 },
    { id: "jlm-kiryat-menachem", name_he: "קריית מנחם ועיר גנים", name_en: "Kiryat Menachem & Ir Ganim", lng: 35.17067, lat: 31.75463 },
    { id: "jlm-malha", name_he: "מנחת (מלחה)", name_en: "Manahat (Malha)", lng: 35.1848, lat: 31.75176 },
    { id: "jlm-givat-masua", name_he: "גבעת משואה", name_en: "Givat Masua", lng: 35.16971, lat: 31.74923 },
    { id: "jlm-katamonim", name_he: "הקטמונים ופת", name_en: "Katamonim & Pat", lng: 35.20444, lat: 31.75569 },
    { id: "jlm-givat-mordechai", name_he: "גבעת מרדכי", name_en: "Givat Mordechai", lng: 35.1984, lat: 31.76263 },
    { id: "jlm-rassco", name_he: "רסקו וגבעת הוורדים", name_en: "Rassco & Givat HaVradim", lng: 35.20644, lat: 31.76417 },
    { id: "jlm-old-katamon", name_he: "קטמון הישנה", name_en: "Old Katamon", lng: 35.21117, lat: 31.76328 },
    { id: "jlm-german-colony", name_he: "המושבה הגרמנית והיוונית", name_en: "German & Greek Colony", lng: 35.21871, lat: 31.7649 },
    { id: "jlm-talbiyeh", name_he: "טלביה וימין משה", name_en: "Talbiyeh & Yemin Moshe", lng: 35.22299, lat: 31.77183 },
    { id: "jlm-baka", name_he: "בקעה", name_en: "Baka", lng: 35.21888, lat: 31.75778 },
    { id: "jlm-abu-tor", name_he: "אבו תור", name_en: "Abu Tor", lng: 35.23043, lat: 31.76491 },
    { id: "jlm-talpiot", name_he: "תלפיות", name_en: "Talpiot", lng: 35.22318, lat: 31.75355 },
    { id: "jlm-musrara", name_he: "מוסררה (מורשה)", name_en: "Musrara (Morasha)", lng: 35.22613, lat: 31.78301 },
    { id: "jlm-city-center", name_he: "מרכז העיר", name_en: "City Center", lng: 35.2192, lat: 31.78195 },
    { id: "jlm-nachlaot", name_he: "נחלאות ומחנה יהודה", name_en: "Nachlaot & Mahane Yehuda", lng: 35.21066, lat: 31.78259 },
    { id: "jlm-rehavia", name_he: "רחביה", name_en: "Rehavia", lng: 35.21194, lat: 31.77359 },
    { id: "jlm-givat-shaul", name_he: "גבעת שאול", name_en: "Givat Shaul", lng: 35.19259, lat: 31.79059 },
    { id: "jlm-har-nof", name_he: "הר נוף", name_en: "Har Nof", lng: 35.16816, lat: 31.7883 },
    { id: "jlm-har-homa", name_he: "הר חומה (חומת שמואל)", name_en: "Har Homa (Homat Shmuel)", lng: 35.2241, lat: 31.72214 },
    { id: "jlm-bayit-vegan", name_he: "בית וגן", name_en: "Bayit VeGan", lng: 35.18555, lat: 31.76642 },
    { id: "jlm-ramat-sharett", name_he: "רמת שרת ורמת דניה", name_en: "Ramat Sharett & Ramat Denya", lng: 35.18436, lat: 31.75937 },
    { id: "jlm-holyland", name_he: "הולילנד", name_en: "Holyland", lng: 35.19054, lat: 31.75813 },
    { id: "jlm-arnona", name_he: "ארנונה", name_en: "Arnona", lng: 35.21975, lat: 31.74573 },
    { id: "jlm-ramot-rachel", name_he: "רמות רחל (ארנונה החדשה)", name_en: "Ramot Rachel (New Arnona)", lng: 35.22567, lat: 31.75166 },
    { id: "jlm-mekor-haim", name_he: "מקור חיים", name_en: "Mekor Haim", lng: 35.21217, lat: 31.75426 },
    { id: "jlm-east-talpiot", name_he: "תלפיות מזרח (ארמון הנציב)", name_en: "East Talpiot (Armon HaNatziv)", lng: 35.23522, lat: 31.74846 },
    { id: "jlm-gilo", name_he: "גילה", name_en: "Gilo", lng: 35.18917, lat: 31.73473 },
    { id: "jlm-kafr-aqab", name_he: "כפר עקב", name_en: "Kafr Aqab", lng: 35.22133, lat: 31.87236 },
    { id: "jlm-beit-hanina", name_he: "בית חנינא", name_en: "Beit Hanina", lng: 35.22145, lat: 31.83665 },
    { id: "jlm-anata-shuafat-camp", name_he: "ענאתא ומחנה שועפאט", name_en: "Anata & Shu'fat Camp", lng: 35.25341, lat: 31.80833 },
    { id: "jlm-shuafat", name_he: "שועפאט", name_en: "Shu'fat", lng: 35.23084, lat: 31.81427 },
    { id: "jlm-issawiya", name_he: "עיסאוויה", name_en: "Issawiya", lng: 35.25456, lat: 31.79452 },
    { id: "jlm-a-tur", name_he: "א-טור והר הזיתים", name_en: "At-Tur & Mount of Olives", lng: 35.24935, lat: 31.77963 },
    { id: "jlm-sheikh-jarrah", name_he: "שייח' ג'ראח ו-ואדי ג'וז", name_en: "Sheikh Jarrah & Wadi al-Joz", lng: 35.23459, lat: 31.79085 },
    { id: "jlm-bab-a-zahra", name_he: "באב א-זהרה", name_en: "Bab al-Zahra", lng: 35.23118, lat: 31.78493 },
    { id: "jlm-muslim-quarter", name_he: "הרובע המוסלמי", name_en: "Muslim Quarter", lng: 35.23364, lat: 31.78019 },
    { id: "jlm-jewish-quarter", name_he: "הרובע היהודי", name_en: "Jewish Quarter", lng: 35.23277, lat: 31.77526 },
    { id: "jlm-armenian-quarter", name_he: "הרובע הארמני", name_en: "Armenian Quarter", lng: 35.22899, lat: 31.77478 },
    { id: "jlm-christian-quarter", name_he: "הרובע הנוצרי", name_en: "Christian Quarter", lng: 35.22904, lat: 31.77914 },
    { id: "jlm-silwan", name_he: "סילואן ועיר דוד", name_en: "Silwan & City of David", lng: 35.2371, lat: 31.77244 },
    { id: "jlm-ras-al-amud", name_he: "ראס אל-עמוד", name_en: "Ras al-Amud", lng: 35.24827, lat: 31.76681 },
    { id: "jlm-jabel-mukaber", name_he: "ג'בל מוקאבר וא-סוואחרה", name_en: "Jabel Mukaber & as-Sawahira", lng: 35.25037, lat: 31.75254 },
    { id: "jlm-sur-baher", name_he: "צור באהר ואום טובא", name_en: "Sur Baher & Umm Tuba", lng: 35.2409, lat: 31.72829 },
    { id: "jlm-beit-safafa", name_he: "בית צפאפא ושרפאת", name_en: "Beit Safafa & Sharafat", lng: 35.20171, lat: 31.74281 },
  ],
  // Fully explicit (every STAT_2022 listed): neighborhoods follow the municipal
  // list, not nearest-anchor.
  statOverrides: {
    324: "__nonresidential_discard__", // COD_TIFKUD=4 — open land N of Ramot
    511: "__nonresidential_discard__", // =2 — Har Hotzvim hi-tech park
    543: "__nonresidential_discard__", // =6 — Mt Scopus campus (Hebrew U + Hadassah)
    924: "__nonresidential_discard__", // =4 — Lifta valley
    1021: "__nonresidential_discard__", // =6 — Kiryat HaLeom (Knesset, ministries, Israel Museum)
    1023: "__nonresidential_discard__", // =6 — Givat Ram campus
    1024: "__nonresidential_discard__", // =5 — Givat Ram campus
    1026: "__nonresidential_discard__", // =6 — Kiryat HaLeom
    1111: "__nonresidential_discard__", // =4 — Jerusalem forest / open land
    1112: "__nonresidential_discard__", // =4 — open land W of Kiryat HaYovel
    1113: "__nonresidential_discard__", // =4 — open land by Hadassah
    1114: "__nonresidential_discard__", // =5 — Hadassah Ein Kerem medical center
    1151: "__nonresidential_discard__", // =6 — Malha mall + Teddy stadium
    1153: "__nonresidential_discard__", // =6 — non-residential belt by Givat Masua, no census pop
    1155: "__nonresidential_discard__", // =4 — open land (Refaim valley)
    1411: "__nonresidential_discard__", // =6 — Mamilla commercial
    1515: "__nonresidential_discard__", // =6 — Givat Shaul industrial + Har HaMenuchot cemetery
    1611: "__nonresidential_discard__", // =4 — Givat HaMatos (open in 2022; under construction since) ⚠ REVIEW
    1612: "__nonresidential_discard__", // =4 — open land, Mar Elias / Har Homa slopes
    1713: "__nonresidential_discard__", // =6 — Yad Vashem + Mt Herzl
    1813: "__nonresidential_discard__", // =4 — kibbutz Ramat Rachel + Arnona Hills (new build after 2022; no census row) ⚠ REVIEW
    1817: "__nonresidential_discard__", // =2 — Talpiot industrial zone
    2112: "__nonresidential_discard__", // =2 — Atarot industrial zone + former airport
    2214: "__nonresidential_discard__", // =4 — open land
    2914: "__nonresidential_discard__", // =4 — open land S of Beit Safafa / Gilo slopes
    111: "jlm-neve-yaakov", 112: "jlm-neve-yaakov", 113: "jlm-neve-yaakov", 114: "jlm-neve-yaakov", 115: "jlm-neve-yaakov", 116: "jlm-neve-yaakov", 117: "jlm-neve-yaakov",
    211: "jlm-pisgat-zeev", 212: "jlm-pisgat-zeev", 213: "jlm-pisgat-zeev", 214: "jlm-pisgat-zeev", 215: "jlm-pisgat-zeev", 221: "jlm-pisgat-zeev", 222: "jlm-pisgat-zeev", 223: "jlm-pisgat-zeev", 224: "jlm-pisgat-zeev", 225: "jlm-pisgat-zeev", 226: "jlm-pisgat-zeev",
    311: "jlm-ramot", 312: "jlm-ramot", 321: "jlm-ramot", 322: "jlm-ramot", 323: "jlm-ramot", 411: "jlm-ramot", 412: "jlm-ramot", 413: "jlm-ramot", 421: "jlm-ramot", 422: "jlm-ramot", 431: "jlm-ramot", 432: "jlm-ramot", 433: "jlm-ramot",
    512: "jlm-tel-arza", 513: "jlm-tel-arza", 514: "jlm-tel-arza",
    515: "jlm-sanhedria", 521: "jlm-sanhedria",
    522: "jlm-ramat-eshkol", 523: "jlm-ramat-eshkol", 524: "jlm-ramat-eshkol",
    531: "jlm-maalot-dafna", 532: "jlm-maalot-dafna", 533: "jlm-maalot-dafna",
    541: "jlm-french-hill", 542: "jlm-french-hill",
    611: "jlm-ramat-shlomo", 612: "jlm-ramat-shlomo", 613: "jlm-ramat-shlomo",
    711: "jlm-bukharim", 712: "jlm-bukharim",
    713: "jlm-kerem-avraham",
    714: "jlm-geula", 815: "jlm-geula", 816: "jlm-geula",
    721: "jlm-beit-israel", 722: "jlm-beit-israel",
    723: "jlm-mea-shearim", 724: "jlm-mea-shearim",
    811: "jlm-mekor-baruch", 812: "jlm-mekor-baruch", 813: "jlm-mekor-baruch", 814: "jlm-mekor-baruch",
    911: "jlm-kiryat-sanz", 912: "jlm-kiryat-sanz", 921: "jlm-kiryat-sanz",
    913: "jlm-romema", 914: "jlm-romema", 922: "jlm-romema", 923: "jlm-romema",
    1011: "jlm-beit-hakerem", 1012: "jlm-beit-hakerem", 1013: "jlm-beit-hakerem", 1014: "jlm-beit-hakerem",
    1022: "jlm-nayot",
    1031: "jlm-kiryat-moshe", 1032: "jlm-kiryat-moshe", 1033: "jlm-kiryat-moshe",
    1115: "jlm-ein-kerem", 1116: "jlm-ein-kerem",
    1121: "jlm-kiryat-hayovel", 1122: "jlm-kiryat-hayovel", 1123: "jlm-kiryat-hayovel", 1124: "jlm-kiryat-hayovel", 1125: "jlm-kiryat-hayovel", 1131: "jlm-kiryat-hayovel", 1132: "jlm-kiryat-hayovel", 1133: "jlm-kiryat-hayovel",
    1141: "jlm-kiryat-menachem", 1142: "jlm-kiryat-menachem", 1143: "jlm-kiryat-menachem", 1144: "jlm-kiryat-menachem",
    1152: "jlm-malha",
    1154: "jlm-givat-masua",
    1211: "jlm-katamonim", 1212: "jlm-katamonim", 1213: "jlm-katamonim", 1214: "jlm-katamonim", 1215: "jlm-katamonim", 1216: "jlm-katamonim",
    1221: "jlm-givat-mordechai",
    1222: "jlm-rassco", 1223: "jlm-rassco",
    1311: "jlm-old-katamon", 1312: "jlm-old-katamon", 1315: "jlm-old-katamon",
    1313: "jlm-german-colony", 1314: "jlm-german-colony",
    1321: "jlm-talbiyeh", 1322: "jlm-talbiyeh", 1332: "jlm-talbiyeh",
    1333: "jlm-baka", 1334: "jlm-baka", 1335: "jlm-baka",
    1336: "jlm-abu-tor", 2612: "jlm-abu-tor",
    1331: "jlm-talpiot", 1337: "jlm-talpiot", 1812: "jlm-talpiot", 1815: "jlm-talpiot", 1816: "jlm-talpiot",
    1412: "jlm-musrara",
    1421: "jlm-city-center", 1422: "jlm-city-center", 1423: "jlm-city-center", 1424: "jlm-city-center", 1425: "jlm-city-center",
    1025: "jlm-nachlaot", 1431: "jlm-nachlaot", 1432: "jlm-nachlaot", 1433: "jlm-nachlaot", 1434: "jlm-nachlaot", 1435: "jlm-nachlaot", 1436: "jlm-nachlaot", 1437: "jlm-nachlaot", 1438: "jlm-nachlaot",
    1426: "jlm-rehavia", 1441: "jlm-rehavia", 1442: "jlm-rehavia", 1443: "jlm-rehavia", 1444: "jlm-rehavia",
    1511: "jlm-givat-shaul", 1512: "jlm-givat-shaul", 1513: "jlm-givat-shaul", 1514: "jlm-givat-shaul",
    1516: "jlm-har-nof", 1521: "jlm-har-nof", 1522: "jlm-har-nof", 1523: "jlm-har-nof", 1524: "jlm-har-nof", 1525: "jlm-har-nof",
    1613: "jlm-har-homa", 1614: "jlm-har-homa", 1615: "jlm-har-homa", 1616: "jlm-har-homa", 1617: "jlm-har-homa", 1618: "jlm-har-homa",
    1711: "jlm-bayit-vegan", 1712: "jlm-bayit-vegan", 1714: "jlm-bayit-vegan", 1715: "jlm-bayit-vegan", 1716: "jlm-bayit-vegan",
    1721: "jlm-ramat-sharett", 1722: "jlm-ramat-sharett", 1723: "jlm-ramat-sharett",
    1724: "jlm-holyland",
    1814: "jlm-arnona",
    1811: "jlm-ramot-rachel",
    1818: "jlm-mekor-haim",
    1821: "jlm-east-talpiot", 1822: "jlm-east-talpiot", 1823: "jlm-east-talpiot", 1824: "jlm-east-talpiot", 1825: "jlm-east-talpiot",
    1911: "jlm-gilo", 1912: "jlm-gilo", 1913: "jlm-gilo", 1914: "jlm-gilo", 1921: "jlm-gilo", 1922: "jlm-gilo", 1923: "jlm-gilo", 1924: "jlm-gilo",
    2111: "jlm-kafr-aqab",
    2121: "jlm-beit-hanina", 2122: "jlm-beit-hanina", 2123: "jlm-beit-hanina", 2124: "jlm-beit-hanina", 2125: "jlm-beit-hanina", 2126: "jlm-beit-hanina",
    2211: "jlm-anata-shuafat-camp", 2212: "jlm-anata-shuafat-camp", 2213: "jlm-anata-shuafat-camp",
    2221: "jlm-shuafat", 2222: "jlm-shuafat",
    2311: "jlm-issawiya", 2312: "jlm-issawiya",
    2321: "jlm-a-tur", 2322: "jlm-a-tur", 2323: "jlm-a-tur", 2324: "jlm-a-tur",
    2411: "jlm-sheikh-jarrah", 2412: "jlm-sheikh-jarrah",
    2413: "jlm-bab-a-zahra", 2414: "jlm-bab-a-zahra",
    2511: "jlm-muslim-quarter",
    2512: "jlm-jewish-quarter",
    2513: "jlm-armenian-quarter",
    2514: "jlm-christian-quarter",
    2611: "jlm-silwan", 2613: "jlm-silwan",
    2621: "jlm-ras-al-amud", 2622: "jlm-ras-al-amud",
    2711: "jlm-jabel-mukaber", 2712: "jlm-jabel-mukaber",
    2811: "jlm-sur-baher", 2812: "jlm-sur-baher", 2813: "jlm-sur-baher",
    2911: "jlm-beit-safafa", 2912: "jlm-beit-safafa", 2913: "jlm-beit-safafa",
  },
  demographicsOut: "jerusalem.demographics.json",
  crimeOut: "jerusalem.crime.json",
  schoolsOut: "jerusalem.schools.json",
  transitOut: "jerusalem.transit.json",
  environmentOut: "jerusalem.environment.json",
  pricesOut: "jerusalem.prices.json",
  moeCityName: "ירושלים",
  gtfsCityName: "ירושלים",
};


/** תל אביב - יפו (semel 5000) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const telaviv: CityConfig = {
  id: "telaviv",
  semelYishuv: 5000,
  outFile: "public/neighborhoods.telaviv.geo.json",
  anchors: [
    { id: "tlv-ramat-aviv-gimel", name_he: "רמת אביב ג׳", name_en: "Ramat Aviv Gimel", lng: 34.80192, lat: 32.12582 },
    { id: "tlv-kochav-hatzafon", name_he: "כוכב הצפון", name_en: "Kochav Hatzafon", lng: 34.78685, lat: 32.10066 },
    { id: "tlv-neve-avivim", name_he: "נווה אביבים", name_en: "Neve Avivim", lng: 34.79678, lat: 32.11727 },
    { id: "tlv-ramat-aviv", name_he: "רמת אביב", name_en: "Ramat Aviv", lng: 34.79595, lat: 32.10777 },
    { id: "tlv-nofei-yam", name_he: "נופי ים", name_en: "Nofei Yam", lng: 34.78751, lat: 32.11789 },
    { id: "tlv-tochnit-lamed", name_he: "תכנית ל׳", name_en: "Tochnit Lamed", lng: 34.78683, lat: 32.10685 },
    { id: "tlv-bavli", name_he: "בבלי", name_en: "Bavli", lng: 34.79803, lat: 32.09476 },
    { id: "tlv-hamishtala", name_he: "המשתלה", name_en: "Hamishtala", lng: 34.83122, lat: 32.12648 },
    { id: "tlv-ganei-tzahala", name_he: "גני צהלה", name_en: "Ganei Tzahala", lng: 34.82749, lat: 32.12193 },
    { id: "tlv-tzahala", name_he: "צהלה", name_en: "Tzahala", lng: 34.83557, lat: 32.12185 },
    { id: "tlv-tel-baruch", name_he: "תל ברוך", name_en: "Tel Baruch", lng: 34.81373, lat: 32.11804 },
    { id: "tlv-neot-afeka-bet", name_he: "נאות אפקה ב׳", name_en: "Neot Afeka Bet", lng: 34.82147, lat: 32.11908 },
    { id: "tlv-revivim", name_he: "רביבים", name_en: "Revivim", lng: 34.82888, lat: 32.11608 },
    { id: "tlv-neot-afeka-alef", name_he: "נאות אפקה א׳", name_en: "Neot Afeka Alef", lng: 34.82057, lat: 32.11485 },
    { id: "tlv-tel-baruch-north", name_he: "תל ברוך צפון", name_en: "Tel Baruch North", lng: 34.81704, lat: 32.1227 },
    { id: "tlv-new-north-north", name_he: "הצפון החדש (צפון)", name_en: "New North North", lng: 34.78832, lat: 32.09406 },
    { id: "tlv-old-north-north", name_he: "הצפון הישן (צפון)", name_en: "Old North North", lng: 34.77538, lat: 32.08914 },
    { id: "tlv-park-tzameret", name_he: "פארק צמרת", name_en: "Park Tzameret", lng: 34.79649, lat: 32.08458 },
    { id: "tlv-kikar-hamedina", name_he: "כיכר המדינה", name_en: "Kikar Hamedina", lng: 34.78806, lat: 32.08653 },
    { id: "tlv-old-north-south", name_he: "הצפון הישן (דרום)", name_en: "Old North South", lng: 34.77371, lat: 32.07781 },
    { id: "tlv-new-north-south", name_he: "הצפון החדש (דרום)", name_en: "New North South", lng: 34.78699, lat: 32.08005 },
    { id: "tlv-lev-hair", name_he: "לב העיר", name_en: "Lev Hair", lng: 34.77512, lat: 32.06969 },
    { id: "tlv-kerem-hateimanim", name_he: "כרם התימנים", name_en: "Kerem Hateimanim", lng: 34.7659, lat: 32.06992 },
    { id: "tlv-montefiore", name_he: "מונטיפיורי", name_en: "Montefiore", lng: 34.79013, lat: 32.06962 },
    { id: "tlv-ganei-sarona", name_he: "גני שרונה", name_en: "Ganei Sarona", lng: 34.78525, lat: 32.07191 },
    { id: "tlv-neve-shaanan", name_he: "נווה שאנן", name_en: "Neve Shaanan", lng: 34.7791, lat: 32.058 },
    { id: "tlv-florentin", name_he: "פלורנטין", name_en: "Florentin", lng: 34.76795, lat: 32.05739 },
    { id: "tlv-shapira", name_he: "שפירא", name_en: "Shapira", lng: 34.77888, lat: 32.05058 },
    { id: "tlv-kiryat-shalom", name_he: "קריית שלום", name_en: "Kiryat Shalom", lng: 34.77688, lat: 32.04333 },
    { id: "tlv-old-jaffa", name_he: "יפו העתיקה", name_en: "Old Jaffa", lng: 34.75111, lat: 32.0517 },
    { id: "tlv-nahalat-yitzhak", name_he: "נחלת יצחק", name_en: "Nahalat Yitzhak", lng: 34.79698, lat: 32.07455 },
    { id: "tlv-bitzaron", name_he: "ביצרון ורמת ישראל", name_en: "Bitzaron", lng: 34.79702, lat: 32.0679 },
    { id: "tlv-tel-haim", name_he: "תל חיים", name_en: "Tel Haim", lng: 34.80205, lat: 32.06222 },
    { id: "tlv-yad-eliyahu", name_he: "יד אליהו", name_en: "Yad Eliyahu", lng: 34.7926, lat: 32.05822 },
    { id: "tlv-ramat-hatayasim", name_he: "רמת הטייסים", name_en: "Ramat Hatayasim", lng: 34.80726, lat: 32.05802 },
    { id: "tlv-orot", name_he: "אורות", name_en: "Orot", lng: 34.80255, lat: 32.05588 },
    { id: "tlv-hatikva", name_he: "שכונת התקווה", name_en: "Hatikva", lng: 34.79183, lat: 32.05007 },
    { id: "tlv-neve-chen", name_he: "נווה חן", name_en: "Neve Chen", lng: 34.8096, lat: 32.05256 },
    { id: "tlv-kfar-shalem-east", name_he: "כפר שלם מזרח", name_en: "Kfar Shalem East", lng: 34.80683, lat: 32.04973 },
    { id: "tlv-kfar-shalem-west", name_he: "כפר שלם מערב", name_en: "Kfar Shalem West", lng: 34.80185, lat: 32.0515 },
    { id: "tlv-neve-kfir", name_he: "נווה כפיר", name_en: "Neve Kfir", lng: 34.80248, lat: 32.04753 },
    { id: "tlv-nir-aviv", name_he: "ניר אביב", name_en: "Nir Aviv", lng: 34.81131, lat: 32.04876 },
    { id: "tlv-haargazim", name_he: "הארגזים", name_en: "Haargazim", lng: 34.79377, lat: 32.04428 },
    { id: "tlv-livne-yedidya", name_he: "לבנה וידידיה", name_en: "Livne Yedidya", lng: 34.8064, lat: 32.04358 },
    { id: "tlv-ramat-hahayal", name_he: "רמת החייל", name_en: "Ramat Hahayal", lng: 34.83531, lat: 32.11243 },
    { id: "tlv-yafo-dalet", name_he: "יפו ד׳ (גבעת התמרים)", name_en: "Yafo Dalet", lng: 34.75498, lat: 32.03381 },
    { id: "tlv-neve-dan", name_he: "נווה דן", name_en: "Neve Dan", lng: 34.82798, lat: 32.11055 },
    { id: "tlv-hadar-yosef", name_he: "הדר יוסף", name_en: "Hadar Yosef", lng: 34.82052, lat: 32.10938 },
    { id: "tlv-maoz-aviv", name_he: "מעוז אביב", name_en: "Maoz Aviv", lng: 34.8132, lat: 32.10986 },
    { id: "tlv-neve-tzedek", name_he: "נווה צדק", name_en: "Neve Tzedek", lng: 34.76342, lat: 32.0628 },
    { id: "tlv-north-jaffa", name_he: "צפון יפו", name_en: "North Jaffa", lng: 34.75895, lat: 32.05291 },
    { id: "tlv-dakar", name_he: "דקר", name_en: "Dakar", lng: 34.75926, lat: 32.04323 },
    { id: "tlv-afeka", name_he: "אפקה", name_en: "Afeka", lng: 34.80557, lat: 32.12051 },
    { id: "tlv-givat-herzl", name_he: "גבעת הרצל", name_en: "Givat Herzl", lng: 34.76634, lat: 32.04977 },
    { id: "tlv-neve-sharett", name_he: "נווה שרת", name_en: "Neve Sharett", lng: 34.84013, lat: 32.11885 },
    { id: "tlv-tel-kabir", name_he: "תל כביר ונווה עופר", name_en: "Tel Kabir", lng: 34.76547, lat: 32.04156 },
    { id: "tlv-yafo-gimel", name_he: "יפו ג׳ ונווה גולן", name_en: "Yafo Gimel", lng: 34.74764, lat: 32.03323 },
    { id: "tlv-ajami", name_he: "עג׳מי וגבעת עלייה", name_en: "Ajami", lng: 34.74768, lat: 32.04208 },
    { id: "tlv-tzahalon", name_he: "צהלון ושיכוני חיסכון", name_en: "Tzahalon", lng: 34.75407, lat: 32.04349 },
    { id: "tlv-ramat-aviv-hahadasha", name_he: "רמת אביב החדשה", name_en: "Ramat Aviv Hahadasha", lng: 34.79125, lat: 32.11732 },
    { id: "tlv-azorei-chen", name_he: "אזורי חן", name_en: "Azorei Chen", lng: 34.79293, lat: 32.12706 },
  ],
  demographicsOut: "telaviv.demographics.json",
  crimeOut: "telaviv.crime.json",
  schoolsOut: "telaviv.schools.json",
  transitOut: "telaviv.transit.json",
  environmentOut: "telaviv.environment.json",
  pricesOut: "telaviv.prices.json",
  moeCityName: "תל אביב - יפו",
  gtfsCityName: "תל אביב יפו",
};

/** רמת גן (semel 8600) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const ramatgan: CityConfig = {
  id: "ramatgan",
  semelYishuv: 8600,
  outFile: "public/neighborhoods.ramatgan.geo.json",
  anchors: [
    { id: "rg-yad-labanim", name_he: "יד לבנים", name_en: "Yad Labanim", lng: 34.82252, lat: 32.07656 },
    { id: "rg-tel-ganim", name_he: "תל גנים", name_en: "Tel Ganim", lng: 34.81722, lat: 32.06479 },
    { id: "rg-ramat-amidar", name_he: "רמת עמידר", name_en: "Ramat Amidar", lng: 34.8358, lat: 32.06759 },
    { id: "rg-shikun-hamizrahi", name_he: "שיכון המזרחי", name_en: "Shikun Hamizrahi", lng: 34.82995, lat: 32.06637 },
    { id: "rg-negba", name_he: "נגבה", name_en: "Negba", lng: 34.82416, lat: 32.06659 },
    { id: "rg-tel-yehuda", name_he: "תל יהודה", name_en: "Tel Yehuda", lng: 34.82235, lat: 32.07228 },
    { id: "rg-kiryat-krinitzi", name_he: "קריית קריניצי", name_en: "Kiryat Krinitzi", lng: 34.84702, lat: 32.0558 },
    { id: "rg-ramat-chen", name_he: "רמת חן", name_en: "Ramat Chen", lng: 34.81814, lat: 32.05558 },
    { id: "rg-hagefen", name_he: "הגפן", name_en: "Hagefen", lng: 34.81201, lat: 32.0887 },
    { id: "rg-ramat-shikma", name_he: "רמת שקמה", name_en: "Ramat Shikma", lng: 34.81753, lat: 32.05017 },
    { id: "rg-tel-binyamin", name_he: "תל בנימין", name_en: "Tel Binyamin", lng: 34.80685, lat: 32.08508 },
    { id: "rg-merkaz-gimel", name_he: "מרכז העיר ג׳", name_en: "Merkaz Gimel", lng: 34.81688, lat: 32.08677 },
    { id: "rg-hillel", name_he: "הלל", name_en: "Hillel", lng: 34.82254, lat: 32.08122 },
    { id: "rg-harishonim", name_he: "הראשונים", name_en: "Harishonim", lng: 34.80403, lat: 32.08064 },
    { id: "rg-marom-nave", name_he: "מרום נווה", name_en: "Marom Nave", lng: 34.82969, lat: 32.07266 },
    { id: "rg-nahalat-ganim", name_he: "נחלת גנים", name_en: "Nahalat Ganim", lng: 34.8188, lat: 32.09283 },
    { id: "rg-neve-yehoshua", name_he: "נווה יהושע", name_en: "Neve Yehoshua", lng: 34.83146, lat: 32.06038 },
    { id: "rg-haruzim", name_he: "חרוזים", name_en: "Haruzim", lng: 34.80365, lat: 32.08984 },
    { id: "rg-ramat-efal", name_he: "רמת אפעל", name_en: "Ramat Efal", lng: 34.83473, lat: 32.04587 },
    { id: "rg-kfar-azar", name_he: "כפר אז״ר", name_en: "Kfar Azar", lng: 34.83856, lat: 32.05615 },
    { id: "rg-shikun-tzanhanim", name_he: "שיכון צנחנים", name_en: "Shikun Tzanhanim", lng: 34.82902, lat: 32.05475 },
    { id: "rg-kiryat-borochov", name_he: "קריית בורוכוב", name_en: "Kiryat Borochov", lng: 34.81885, lat: 32.06855 },
    { id: "rg-merkaz-bet", name_he: "מרכז העיר ב׳", name_en: "Merkaz Bet", lng: 34.81689, lat: 32.08093 },
    { id: "rg-merkaz-alef", name_he: "מרכז העיר א׳", name_en: "Merkaz Alef", lng: 34.80936, lat: 32.0816 },
    { id: "rg-vatikim", name_he: "שיכון ותיקים", name_en: "Vatikim", lng: 34.81211, lat: 32.09282 },
    { id: "rg-habursa", name_he: "מתחם הבורסה", name_en: "Habursa", lng: 34.80151, lat: 32.08551 },
  ],
  demographicsOut: "ramatgan.demographics.json",
  crimeOut: "ramatgan.crime.json",
  schoolsOut: "ramatgan.schools.json",
  transitOut: "ramatgan.transit.json",
  environmentOut: "ramatgan.environment.json",
  pricesOut: "ramatgan.prices.json",
  moeCityName: "רמת גן",
  gtfsCityName: "רמת גן",
};

/** גבעתיים (semel 6300) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const givatayim: CityConfig = {
  id: "givatayim",
  semelYishuv: 6300,
  outFile: "public/neighborhoods.givatayim.geo.json",
  anchors: [
    { id: "giv-kiryat-yosef", name_he: "קריית יוסף", name_en: "Kiryat Yosef", lng: 34.80315, lat: 32.0757 },
    { id: "giv-borochov", name_he: "בורוכוב", name_en: "Borochov", lng: 34.80755, lat: 32.07721 },
    { id: "giv-halah", name_he: "הל״ה", name_en: "Halah", lng: 34.80408, lat: 32.07339 },
    { id: "giv-poalei-harakevet", name_he: "פועלי הרכבת", name_en: "Poalei Harakevet", lng: 34.81637, lat: 32.0776 },
    { id: "giv-sheinkin", name_he: "שינקין", name_en: "Sheinkin", lng: 34.81291, lat: 32.07469 },
    { id: "giv-givat-kozlovsky", name_he: "גבעת קוזלובסקי", name_en: "Givat Kozlovsky", lng: 34.81575, lat: 32.07079 },
    { id: "giv-arlozorov", name_he: "ארלוזרוב", name_en: "Arlozorov", lng: 34.81109, lat: 32.07108 },
    { id: "giv-givat-rambam", name_he: "גבעת רמב״ם", name_en: "Givat Rambam", lng: 34.80481, lat: 32.06903 },
    { id: "giv-shetach-9", name_he: "שטח 9", name_en: "Shetach 9", lng: 34.81218, lat: 32.06617 },
    { id: "giv-shikun-hevrat-hashmal", name_he: "שיכון חברת חשמל", name_en: "Shikun Hevrat Hashmal", lng: 34.80719, lat: 32.06275 },
    { id: "giv-tel-ganim", name_he: "תל גנים", name_en: "Tel Ganim", lng: 34.81414, lat: 32.06226 },
  ],
  demographicsOut: "givatayim.demographics.json",
  crimeOut: "givatayim.crime.json",
  schoolsOut: "givatayim.schools.json",
  transitOut: "givatayim.transit.json",
  environmentOut: "givatayim.environment.json",
  pricesOut: "givatayim.prices.json",
  moeCityName: "גבעתיים",
  gtfsCityName: "גבעתיים",
};

/** חולון (semel 6600) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const holon: CityConfig = {
  id: "holon",
  semelYishuv: 6600,
  outFile: "public/neighborhoods.holon.geo.json",
  anchors: [
    { id: "hol-green", name_he: "קריית גרין", name_en: "Green", lng: 34.76922, lat: 32.02679 },
    { id: "hol-kiryat-ben-gurion", name_he: "קריית בן גוריון", name_en: "Kiryat Ben Gurion", lng: 34.7702, lat: 31.99613 },
    { id: "hol-neve-arazim", name_he: "נווה ארזים", name_en: "Neve Arazim", lng: 34.79415, lat: 32.01566 },
    { id: "hol-rassco-gimel", name_he: "רסקו ג׳", name_en: "Rassco Gimel", lng: 34.78762, lat: 32.01446 },
    { id: "hol-rassco-alef", name_he: "רסקו א׳", name_en: "Rassco Alef", lng: 34.78234, lat: 32.01874 },
    { id: "hol-kiryat-sharett", name_he: "קריית שרת", name_en: "Kiryat Sharett", lng: 34.79426, lat: 32.00665 },
    { id: "hol-jesse-cohen", name_he: "ג׳סי כהן", name_en: "Jesse Cohen", lng: 34.76402, lat: 32.00397 },
    { id: "hol-kiryat-ayalon", name_he: "קריית פנחס אילון", name_en: "Kiryat Ayalon", lng: 34.77911, lat: 32.01041 },
    { id: "hol-agrobank", name_he: "אגרובנק", name_en: "Agrobank", lng: 34.77823, lat: 32.02515 },
    { id: "hol-tel-giborim", name_he: "תל גיבורים", name_en: "Tel Giborim", lng: 34.76297, lat: 32.02955 },
    { id: "hol-kiryat-rabin", name_he: "קריית רבין", name_en: "Kiryat Rabin", lng: 34.7721, lat: 32.0018 },
    { id: "hol-shikun-vatikim", name_he: "שיכון ותיקים", name_en: "Shikun Vatikim", lng: 34.76693, lat: 32.007 },
    { id: "hol-kiryat-avoda", name_he: "קריית עבודה", name_en: "Kiryat Avoda", lng: 34.77317, lat: 32.01785 },
    { id: "hol-neve-remez", name_he: "נווה רמז", name_en: "Neve Remez", lng: 34.76908, lat: 32.01113 },
    { id: "hol-neot-shoshanim", name_he: "נאות שושנים", name_en: "Neot Shoshanim", lng: 34.78049, lat: 32.01473 },
    { id: "hol-mifde-ezrahi", name_he: "מפדה אזרחי", name_en: "Mifde Ezrahi", lng: 34.78896, lat: 32.02137 },
    { id: "hol-kiryat-sharett-west", name_he: "קריית שרת מערב", name_en: "Kiryat Sharett West", lng: 34.78763, lat: 32.00648 },
    { id: "hol-neot-rachel", name_he: "נאות רחל", name_en: "Neot Rachel", lng: 34.76482, lat: 32.01861 },
    { id: "hol-h-501", name_he: "ח-501 (שדרת המגדלים)", name_en: "H 501", lng: 34.77552, lat: 32.01374 },
    { id: "hol-neot-yehudit", name_he: "נאות יהודית", name_en: "Neot Yehudit", lng: 34.7935, lat: 32.01195 },
    { id: "hol-rassco-bet", name_he: "רסקו ב׳", name_en: "Rassco Bet", lng: 34.7875, lat: 32.01173 },
  ],
  demographicsOut: "holon.demographics.json",
  crimeOut: "holon.crime.json",
  schoolsOut: "holon.schools.json",
  transitOut: "holon.transit.json",
  environmentOut: "holon.environment.json",
  pricesOut: "holon.prices.json",
  moeCityName: "חולון",
  gtfsCityName: "חולון",
};

/** בת ים (semel 6200) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const batyam: CityConfig = {
  id: "batyam",
  semelYishuv: 6200,
  outFile: "public/neighborhoods.batyam.geo.json",
  anchors: [
    { id: "by-north-west", name_he: "צפון-מערב העיר", name_en: "North West", lng: 34.74439, lat: 32.02874 },
    { id: "by-merkaz-hair", name_he: "מרכז העיר", name_en: "Merkaz Hair", lng: 34.74354, lat: 32.0217 },
    { id: "by-ramat-hanasi", name_he: "רמת הנשיא", name_en: "Ramat Hanasi", lng: 34.75523, lat: 32.00847 },
    { id: "by-south-west", name_he: "דרום-מערב העיר", name_en: "South West", lng: 34.73767, lat: 32.00562 },
    { id: "by-ramat-yosef", name_he: "רמת יוסף", name_en: "Ramat Yosef", lng: 34.75741, lat: 32.01904 },
    { id: "by-amidar", name_he: "עמידר", name_en: "Amidar", lng: 34.75414, lat: 32.02822 },
    { id: "by-bayit-vagan", name_he: "בית וגן", name_en: "Bayit Vagan", lng: 34.75166, lat: 32.02408 },
    { id: "by-vatikim", name_he: "ותיקים", name_en: "Vatikim", lng: 34.75159, lat: 32.01865 },
  ],
  demographicsOut: "batyam.demographics.json",
  crimeOut: "batyam.crime.json",
  schoolsOut: "batyam.schools.json",
  transitOut: "batyam.transit.json",
  environmentOut: "batyam.environment.json",
  pricesOut: "batyam.prices.json",
  moeCityName: "בת ים",
  gtfsCityName: "בת ים",
};

/** רמת השרון (semel 2650) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const ramathasharon: CityConfig = {
  id: "ramathasharon",
  semelYishuv: 2650,
  outFile: "public/neighborhoods.ramathasharon.geo.json",
  anchors: [
    { id: "rhs-neve-gan", name_he: "נווה גן", name_en: "Neve Gan", lng: 34.81647, lat: 32.12437 },
    { id: "rhs-golan", name_he: "גולן", name_en: "Golan", lng: 34.83429, lat: 32.14235 },
    { id: "rhs-neve-rom", name_he: "נווה רום", name_en: "Neve Rom", lng: 34.82887, lat: 32.14286 },
    { id: "rhs-hadar", name_he: "הדר", name_en: "Hadar", lng: 34.84075, lat: 32.14083 },
    { id: "rhs-neve-rassco", name_he: "נווה רסקו", name_en: "Neve Rassco", lng: 34.83764, lat: 32.13407 },
    { id: "rhs-neve-magen", name_he: "נווה מגן", name_en: "Neve Magen", lng: 34.84588, lat: 32.1327 },
    { id: "rhs-morasha", name_he: "מורשה", name_en: "Morasha", lng: 34.856, lat: 32.13132 },
    { id: "rhs-alon", name_he: "אלון", name_en: "Alon", lng: 34.84369, lat: 32.14711 },
    { id: "rhs-kiryat-yearim", name_he: "קריית יערים", name_en: "Kiryat Yearim", lng: 34.83185, lat: 32.14965 },
  ],
  demographicsOut: "ramathasharon.demographics.json",
  crimeOut: "ramathasharon.crime.json",
  schoolsOut: "ramathasharon.schools.json",
  transitOut: "ramathasharon.transit.json",
  environmentOut: "ramathasharon.environment.json",
  pricesOut: "ramathasharon.prices.json",
  moeCityName: "רמת השרון",
  gtfsCityName: "רמת השרון",
};

/** הוד השרון (semel 9700) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const hodhasharon: CityConfig = {
  id: "hodhasharon",
  semelYishuv: 9700,
  outFile: "public/neighborhoods.hodhasharon.geo.json",
  anchors: [
    { id: "hod-mitham-1200", name_he: "מתחם 1200", name_en: "Mitham 1200", lng: 34.90025, lat: 32.16746 },
    { id: "hod-magdiel", name_he: "מגדיאל", name_en: "Magdiel", lng: 34.90514, lat: 32.15984 },
    { id: "hod-gil-amal", name_he: "גיל עמל", name_en: "Gil Amal", lng: 34.91864, lat: 32.15649 },
    { id: "hod-sharett", name_he: "שרת", name_en: "Sharett", lng: 34.89305, lat: 32.16113 },
    { id: "hod-ramatayim", name_he: "רמתיים", name_en: "Ramatayim", lng: 34.88333, lat: 32.15746 },
    { id: "hod-hadar", name_he: "הדר", name_en: "Hadar", lng: 34.88429, lat: 32.15042 },
    { id: "hod-neve-hadar", name_he: "נווה הדר", name_en: "Neve Hadar", lng: 34.877, lat: 32.13901 },
    { id: "hod-ramot-menachem", name_he: "רמות מנחם", name_en: "Ramot Menachem", lng: 34.88961, lat: 32.14298 },
    { id: "hod-neve-neeman", name_he: "נווה נאמן", name_en: "Neve Neeman", lng: 34.89883, lat: 32.13763 },
  ],
  demographicsOut: "hodhasharon.demographics.json",
  crimeOut: "hodhasharon.crime.json",
  schoolsOut: "hodhasharon.schools.json",
  transitOut: "hodhasharon.transit.json",
  environmentOut: "hodhasharon.environment.json",
  pricesOut: "hodhasharon.prices.json",
  moeCityName: "הוד השרון",
  gtfsCityName: "הוד השרון",
};

/** רחובות (semel 8400) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const rehovot: CityConfig = {
  id: "rehovot",
  semelYishuv: 8400,
  outFile: "public/neighborhoods.rehovot.geo.json",
  anchors: [
    { id: "rhv-rehovot-hatzeira", name_he: "רחובות הצעירה", name_en: "Rehovot Hatzeira", lng: 34.79162, lat: 31.88306 },
    { id: "rhv-kiryat-moshe", name_he: "קריית משה", name_en: "Kiryat Moshe", lng: 34.78604, lat: 31.88327 },
    { id: "rhv-sela", name_he: "סלע", name_en: "Sela", lng: 34.79735, lat: 31.89144 },
    { id: "rhv-rehovot-haholandit", name_he: "רחובות ההולנדית", name_en: "Rehovot Haholandit", lng: 34.77911, lat: 31.89221 },
    { id: "rhv-ibn-gabirol", name_he: "אבן גבירול", name_en: "Ibn Gabirol", lng: 34.77386, lat: 31.89433 },
    { id: "rhv-neve-amit", name_he: "נווה עמית", name_en: "Neve Amit", lng: 34.79967, lat: 31.90925 },
    { id: "rhv-neve-yehuda", name_he: "נווה יהודה", name_en: "Neve Yehuda", lng: 34.80114, lat: 31.90077 },
    { id: "rhv-marmorek", name_he: "מרמורק", name_en: "Marmorek", lng: 34.80395, lat: 31.88562 },
    { id: "rhv-givati", name_he: "גבעתי", name_en: "Givati", lng: 34.80601, lat: 31.88314 },
    { id: "rhv-havatzelet", name_he: "חבצלת", name_en: "Havatzelet", lng: 34.81449, lat: 31.87454 },
    { id: "rhv-rehovot-hahadasha", name_he: "רחובות החדשה", name_en: "Rehovot Hahadasha", lng: 34.81089, lat: 31.87916 },
    { id: "rhv-oshiot", name_he: "אושיות", name_en: "Oshiot", lng: 34.82156, lat: 31.88118 },
    { id: "rhv-kiryat-hahagana", name_he: "קריית ההגנה", name_en: "Kiryat Hahagana", lng: 34.82747, lat: 31.8836 },
    { id: "rhv-hayovel", name_he: "היובל", name_en: "Hayovel", lng: 34.82566, lat: 31.88763 },
    { id: "rhv-kiryat-david", name_he: "קריית דוד", name_en: "Kiryat David", lng: 34.82585, lat: 31.89103 },
    { id: "rhv-denya", name_he: "דניה", name_en: "Denya", lng: 34.81981, lat: 31.89087 },
    { id: "rhv-shaarayim", name_he: "שעריים", name_en: "Shaarayim", lng: 34.81329, lat: 31.88619 },
    { id: "rhv-merkaz-hair", name_he: "מרכז העיר", name_en: "Merkaz Hair", lng: 34.80803, lat: 31.89229 },
    { id: "rhv-neve-alon", name_he: "נווה אלון", name_en: "Neve Alon", lng: 34.80573, lat: 31.8988 },
    { id: "rhv-binyamin-nordau", name_he: "בנימין ונורדאו", name_en: "Binyamin Nordau", lng: 34.81406, lat: 31.89345 },
    { id: "rhv-weisburg-shkolnik", name_he: "וייסבורג ושקולניק", name_en: "Weisburg Shkolnik", lng: 34.8187, lat: 31.89455 },
    { id: "rhv-avnei-chen", name_he: "אבני חן", name_en: "Avnei Chen", lng: 34.82332, lat: 31.89524 },
    { id: "rhv-azorei-weizmann", name_he: "אזורי ויצמן", name_en: "Azorei Weizmann", lng: 34.82062, lat: 31.8991 },
    { id: "rhv-hehalutz-haavoda", name_he: "החלוץ והעבודה", name_en: "Hehalutz Haavoda", lng: 34.81287, lat: 31.89752 },
    { id: "rhv-miller-meltzer", name_he: "מילר ומלצר", name_en: "Miller Meltzer", lng: 34.81681, lat: 31.90095 },
    { id: "rhv-eisenberg-aharoni", name_he: "אייזנברג ואהרוני", name_en: "Eisenberg Aharoni", lng: 34.81189, lat: 31.90032 },
    { id: "rhv-yahad", name_he: "יחד", name_en: "Yahad", lng: 34.81134, lat: 31.90334 },
    { id: "rhv-rehovot-hamada", name_he: "רחובות המדע", name_en: "Rehovot Hamada", lng: 34.82145, lat: 31.90232 },
  ],
  demographicsOut: "rehovot.demographics.json",
  crimeOut: "rehovot.crime.json",
  schoolsOut: "rehovot.schools.json",
  transitOut: "rehovot.transit.json",
  environmentOut: "rehovot.environment.json",
  pricesOut: "rehovot.prices.json",
  moeCityName: "רחובות",
  gtfsCityName: "רחובות",
};

/** באר שבע (semel 9000) — anchors are the official real-estate site's
 *  (nadlan.gov.il) neighborhood centres, with non-residential zones left out. */
const beersheva: CityConfig = {
  id: "beersheva",
  semelYishuv: 9000,
  outFile: "public/neighborhoods.beersheva.geo.json",
  anchors: [
    { id: "bs-ramot", name_he: "רמות", name_en: "Ramot", lng: 34.81453, lat: 31.26926 },
    { id: "bs-alef", name_he: "שכונה א׳", name_en: "Alef", lng: 34.79004, lat: 31.24773 },
    { id: "bs-bet", name_he: "שכונה ב׳", name_en: "Bet", lng: 34.78996, lat: 31.25451 },
    { id: "bs-gimel", name_he: "שכונה ג׳", name_en: "Gimel", lng: 34.8057, lat: 31.25399 },
    { id: "bs-dalet", name_he: "שכונה ד׳", name_en: "Dalet", lng: 34.79412, lat: 31.26668 },
    { id: "bs-hey", name_he: "שכונה ה׳", name_en: "Hey", lng: 34.77727, lat: 31.25198 },
    { id: "bs-vav", name_he: "שכונה ו׳", name_en: "Vav", lng: 34.77838, lat: 31.26483 },
    { id: "bs-tet", name_he: "שכונה ט׳", name_en: "Tet", lng: 34.77372, lat: 31.24635 },
    { id: "bs-yud-alef", name_he: "שכונה י״א", name_en: "Yud Alef", lng: 34.76729, lat: 31.259 },
    { id: "bs-neve-menachem", name_he: "נווה מנחם (נחל עשן)", name_en: "Neve Menachem", lng: 34.7577, lat: 31.26573 },
    { id: "bs-nahal-beka", name_he: "נחל בקע", name_en: "Nahal Beka", lng: 34.77639, lat: 31.22307 },
    { id: "bs-neve-noy", name_he: "נווה נוי", name_en: "Neve Noy", lng: 34.78526, lat: 31.231 },
    { id: "bs-old-city", name_he: "העיר העתיקה", name_en: "Old City", lng: 34.78809, lat: 31.23991 },
    { id: "bs-neot-lon", name_he: "נאות לון", name_en: "Neot Lon", lng: 34.76154, lat: 31.24875 },
    { id: "bs-neve-zeev", name_he: "נווה זאב", name_en: "Neve Zeev", lng: 34.76949, lat: 31.23588 },
    { id: "bs-merkaz-ezrahi", name_he: "המרכז האזרחי", name_en: "Merkaz Ezrahi", lng: 34.79951, lat: 31.24457 },
    { id: "bs-ramot-harechess", name_he: "רמות הרכס", name_en: "Ramot Harechess", lng: 34.80097, lat: 31.28169 },
  ],
  demographicsOut: "beersheva.demographics.json",
  crimeOut: "beersheva.crime.json",
  schoolsOut: "beersheva.schools.json",
  transitOut: "beersheva.transit.json",
  environmentOut: "beersheva.environment.json",
  pricesOut: "beersheva.prices.json",
  moeCityName: "באר שבע",
  gtfsCityName: "באר שבע",
};

export const CITIES: Record<string, CityConfig> = {
  modiin,
  mevomodiim: mevoModiim,
  oryehuda: orYehuda,
  rishon: rishonLezion,
  kefarsava,
  raanana,
  herzliya,
  netanya,
  petahtikva: petahTikva,
  haifa,
  jerusalem,
  telaviv,
  ramatgan,
  givatayim,
  holon,
  batyam,
  ramathasharon,
  hodhasharon,
  rehovot,
  beersheva,
};

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
};

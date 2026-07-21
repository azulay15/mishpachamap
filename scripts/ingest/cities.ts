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
};

export const CITIES: Record<string, CityConfig> = {
  modiin,
};

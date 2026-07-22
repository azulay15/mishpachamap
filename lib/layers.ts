/**
 * The 8 toggleable map layers. Order matches the handoff layer-pills row.
 * `color` is a CSS variable from styles/mishpachamap.css.
 */
export type LayerId =
  | "price"
  | "school"
  | "preschool"
  | "park"
  | "shop"
  | "transit"
  | "community"
  | "greenscore"
  | "celiac"
  | "playground"
  | "elections";

export type LayerKind = "heatmap" | "poi" | "score";

export type Layer = {
  id: LayerId;
  he: string;
  en: string;
  color: string;
  kind: LayerKind;
  /** Lucide icon name (or handoff icon name — see lib/icons.tsx). */
  icon: string;
};

/**
 * Layers offered in the map's "שכבות" menu.
 *
 * Only layers the real Mapbox map actually renders belong here. `price` and
 * `greenscore` were removed 2026-07-22: they are drawn by `MMMapStub` (the
 * no-env SVG fallback) but were never implemented in `MMMap`, so toggling them
 * on the live map did nothing — and `greenscore` was even on by default. Their
 * `LayerId` members are kept so the stub keeps compiling; re-add an entry here
 * once the real map renders that layer.
 */
export const LAYERS: Layer[] = [
  { id: "school",     he: "בתי ספר",         en: "Schools",    color: "var(--layer-school)",     kind: "poi",     icon: "school" },
  { id: "preschool",  he: "גני ילדים",       en: "Preschools", color: "var(--layer-preschool)",  kind: "poi",     icon: "kid" },
  { id: "park",       he: "פארקים וגינות",   en: "Parks",      color: "var(--layer-park)",       kind: "poi",     icon: "tree" },
  { id: "shop",       he: "קניות ומרכולים",  en: "Shops",      color: "var(--layer-shop)",       kind: "poi",     icon: "cart" },
  { id: "transit",    he: "תחבורה",          en: "Transit",    color: "var(--layer-transit)",    kind: "poi",     icon: "bus" },
  { id: "community",  he: "בתי כנסת וקהילה", en: "Community",  color: "var(--layer-community)",  kind: "poi",     icon: "people" },
  { id: "celiac",     he: "ללא גלוטן",         en: "Celiac",     color: "var(--layer-celiac)",     kind: "poi",     icon: "gluten" },
  { id: "playground", he: "מתקני משחק",         en: "Playgrounds", color: "var(--layer-playground)", kind: "poi",     icon: "kid" },
  { id: "elections",  he: "הצבעה (כנסת)",       en: "Vote",        color: "var(--grey-700)",         kind: "score",   icon: "scroll" },
];

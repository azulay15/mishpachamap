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
  | "celiac";

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

export const LAYERS: Layer[] = [
  { id: "price",      he: "מחיר למ״ר",       en: "Price/m²",   color: "var(--layer-price)",      kind: "heatmap", icon: "tag" },
  { id: "school",     he: "בתי ספר",         en: "Schools",    color: "var(--layer-school)",     kind: "poi",     icon: "school" },
  { id: "preschool",  he: "גני ילדים",       en: "Preschools", color: "var(--layer-preschool)",  kind: "poi",     icon: "kid" },
  { id: "park",       he: "פארקים וגינות",   en: "Parks",      color: "var(--layer-park)",       kind: "poi",     icon: "tree" },
  { id: "shop",       he: "קניות ומרכולים",  en: "Shops",      color: "var(--layer-shop)",       kind: "poi",     icon: "cart" },
  { id: "transit",    he: "תחבורה",          en: "Transit",    color: "var(--layer-transit)",    kind: "poi",     icon: "bus" },
  { id: "community",  he: "בתי כנסת וקהילה", en: "Community",  color: "var(--layer-community)",  kind: "poi",     icon: "people" },
  { id: "greenscore", he: "GreenScore",       en: "GreenScore", color: "var(--layer-greenscore)", kind: "score",   icon: "leaf" },
  { id: "celiac",     he: "ללא גלוטן",         en: "Celiac",     color: "var(--layer-celiac)",     kind: "poi",     icon: "gluten" },
];

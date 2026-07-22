"use client";

import { useEffect, useRef } from "react";
import mapboxgl, { Map as MapboxMap, MapMouseEvent, MapLayerMouseEvent } from "mapbox-gl";
import type { LayerId } from "@/lib/layers";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
if (typeof window !== "undefined" && !mapboxgl.getRTLTextPluginStatus().includes("loaded")) {
  mapboxgl.setRTLTextPlugin(
    "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
    null,
    true,
  );
}

export type NeighborhoodFeatureProps = {
  id: string;
  name_he: string;
  match_score: number;
  /** Hex color of the leading party in the most recent election (for the
   *  `elections` map layer). Null when the neighborhood has no results yet. */
  leading_party_color?: string | null;
  leading_party_he?: string | null;
};

export type POIFeatureProps = {
  id: string;
  type: LayerId;
  name_he: string | null;
  /** Optional SVG-space position (1600x1000) used only by the stub renderer. */
  svgPos?: [number, number];
  /** Photo enrichment (from scripts/ingest/poi_photos.ts). */
  photo_url?: string | null;
  photo_title?: string | null;
  photo_page_url?: string | null;
  photo_license?: string | null;
  photo_artist?: string | null;
  /** Playground attributes (from scripts/ingest/seed_playgrounds.ts). */
  has_shade?: boolean | null;
  modern_equipment?: boolean | null;
};

type Props = {
  neighborhoods: GeoJSON.FeatureCollection<GeoJSON.Polygon, NeighborhoodFeatureProps>;
  pois: GeoJSON.FeatureCollection<GeoJSON.Point, POIFeatureProps>;
  activeLayers: Set<LayerId>;
  selected: string | null;
  hover: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
};

const MODIIN_CENTER: [number, number] = [35.0078, 31.8969];
const LAYER_COLORS: Record<LayerId, string> = {
  price: "#181C21",
  school: "#1256A0",
  preschool: "#4F8FD6",
  park: "#2F8F4F",
  shop: "#C6810E",
  transit: "#B83333",
  community: "#7D5BBE",
  greenscore: "#2F8F4F",
  celiac: "#D45A8A",
  playground: "#F2A93B",
  elections: "#84888E", // not a POI type — fills are data-driven per polygon
};

// Per-POI-type presentation for the map popups. Since the popup is a raw HTML
// string (not React), we can't use <MMIcon> — so we inline the matching lucide
// SVG paths here. Singular Hebrew labels read better for a single place than the
// plural layer names ("פארק / גינה" vs the "פארקים וגינות" layer toggle).
const POI_TYPE_META: Record<string, { he: string; icon: string }> = {
  school: { he: "בית ספר", icon: `<path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10"/><path d="M18 5v17"/><path d="m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6"/><path d="M6 5v17"/><circle cx="12" cy="9" r="2"/>` },
  preschool: { he: "גן ילדים", icon: `<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>` },
  park: { he: "פארק / גינה", icon: `<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>` },
  shop: { he: "מרכול / קניות", icon: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>` },
  transit: { he: "תחבורה", icon: `<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>` },
  community: { he: "בית כנסת / קהילה", icon: `<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>` },
  celiac: { he: "ללא גלוטן", icon: `<path d="m2 22 10-10"/><path d="m16 8-1.17 1.17"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="m8 8-.53.53a3.5 3.5 0 0 0 0 4.94L9 15l1.53-1.53c.55-.55.88-1.25.98-1.97"/><path d="M10.91 5.26c.15-.26.34-.51.56-.73L13 3l1.53 1.53a3.5 3.5 0 0 1 .28 4.62"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/><path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/><path d="m16 16-.53.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.49 3.49 0 0 1 1.97-.98"/><path d="M18.74 13.09c.26-.15.51-.34.73-.56L21 11l-1.53-1.53a3.5 3.5 0 0 0-4.62-.28"/><line x1="2" x2="22" y1="2" y2="22"/>` },
  playground: { he: "מתקן משחק", icon: `<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>` },
};
const POI_DEFAULT_ICON = `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`;

/**
 * Popup header for a POI: a colored icon badge + name + Hebrew type label. This
 * carries the visual weight now that most POIs have no photo — the tinted badge
 * keeps each type recognizable at a glance and colour-matched to its map dot.
 */
function poiPopupHeader(type: string, nameHe: string): string {
  const meta = POI_TYPE_META[type];
  const color = LAYER_COLORS[type as LayerId] ?? "#84888E";
  const icon = meta?.icon ?? POI_DEFAULT_ICON;
  const label = meta?.he ?? "";
  const title = nameHe.trim() || label || "נקודת עניין";
  return `<div style="display:flex;align-items:center;gap:10px;padding:2px 2px 0;">
    <span style="flex:none;width:36px;height:36px;border-radius:10px;background:${color}1A;color:${color};display:grid;place-items:center;">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
    </span>
    <div style="min-width:0;">
      <div style="font-weight:700;font-size:13px;color:var(--grey-900);line-height:1.25;">${escapeHtml(title)}</div>
      ${label ? `<div style="font-size:11px;color:${color};font-weight:600;margin-top:1px;">${escapeHtml(label)}</div>` : ""}
    </div>
  </div>`;
}

export function MMMap({
  neighborhoods,
  pois,
  activeLayers,
  selected,
  hover,
  onSelect,
  onHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const initializedRef = useRef(false);
  // Tracks the last `selected` we flew to so a persona-driven `neighborhoods`
  // change doesn't snap the map back when the user has panned away.
  const lastFlownToRef = useRef<string | null>(null);

  // ---- One-time map init ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      // streets-v12 gives the warm cream-and-green palette closer to the
      // handoff mockup (orange highways, green parks, white roads).
      style: "mapbox://styles/mapbox/streets-v12",
      center: MODIIN_CENTER,
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Recolor streets-v12 to match the handoff mockup:
      //  - warm cream land
      //  - bold pumpkin-orange highways
      //  - subtle white local roads
      //  - bright park green
      // Each setPaintProperty is wrapped in a try since style layer ids can
      // change between mapbox style versions.
      const safeSet = (layerId: string, prop: string, value: unknown) => {
        try {
          (map.setPaintProperty as unknown as (
            id: string,
            p: string,
            v: unknown,
          ) => void)(layerId, prop, value);
        } catch {
          /* layer not present in this style version — ignore */
        }
      };

      // Background / land
      safeSet("land", "background-color", "#F4EFE3");
      safeSet("landuse", "fill-color", "#EFE7D2");
      safeSet("national-park", "fill-color", "#D4E5BA");
      safeSet("park", "fill-color", "#D4E5BA");
      safeSet("pitch", "fill-color", "#D4E5BA");

      // Highways — pumpkin orange, bold
      for (const layer of ["road-motorway", "road-motorway-link", "road-trunk", "road-trunk-link"]) {
        safeSet(layer, "line-color", "#F2A93B");
        safeSet(layer, "line-width", 6);
      }
      for (const layer of ["road-motorway-case", "road-trunk-case"]) {
        safeSet(layer, "line-color", "#D9842B");
      }

      // Primary / secondary roads — white with subtle outline
      for (const layer of ["road-primary", "road-secondary", "road-tertiary"]) {
        safeSet(layer, "line-color", "#FFFFFF");
      }
      for (const layer of ["road-primary-case", "road-secondary-case", "road-tertiary-case"]) {
        safeSet(layer, "line-color", "#D9CDB3");
      }

      // Buildings — fade them so neighborhood polygons dominate
      safeSet("building", "fill-opacity", 0.25);
      safeSet("building", "fill-color", "#E8E4DA");

      // Neighborhoods — uniform bold green like the mockup. The match score
      // is shown elsewhere (cards + ring + selected callout); the map fill
      // just says "this is a neighborhood".
      map.addSource("neighborhoods", { type: "geojson", data: neighborhoods });
      map.addLayer({
        id: "neighborhoods-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": "#9BC97E",
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            0.55,
            13,
            0.50,
            15,
            0.40,
            17,
            0.25,
          ],
        },
      });
      map.addLayer({
        id: "neighborhoods-stroke",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": "#5B9F40",
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });
      // Selected polygon — dashed pumpkin orange stroke matching the mockup.
      map.addLayer({
        id: "neighborhoods-stroke-selected",
        type: "line",
        source: "neighborhoods",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#FF6B00",
          "line-width": 3.5,
          "line-dasharray": [3, 1.5],
        },
      });
      // Hover — solid dark stroke.
      map.addLayer({
        id: "neighborhoods-stroke-hover",
        type: "line",
        source: "neighborhoods",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#181C21",
          "line-width": 2.5,
          "line-opacity": 0.8,
        },
      });

      // POIs
      map.addSource("pois", { type: "geojson", data: pois });
      map.addLayer({
        id: "pois-circles",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "case",
            // Playground without shade: hollow (white core, orange ring).
            ["all",
              ["==", ["get", "type"], "playground"],
              ["!=", ["get", "has_shade"], true],
            ],
            "#FFFFFF",
            [
              "match",
              ["get", "type"],
              "school", LAYER_COLORS.school,
              "preschool", LAYER_COLORS.preschool,
              "park", LAYER_COLORS.park,
              "shop", LAYER_COLORS.shop,
              "transit", LAYER_COLORS.transit,
              "community", LAYER_COLORS.community,
              "celiac", LAYER_COLORS.celiac,
              "playground", LAYER_COLORS.playground,
              /* default */ "#84888E",
            ],
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "type"], "playground"],
            LAYER_COLORS.playground,
            "#FFFFFF",
          ],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "type"], "playground"],
            2.5,
            2,
          ],
          "circle-opacity": 0.95,
        },
      });

      // Click → select
      map.on("click", "neighborhoods-fill", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelect(id);
      });
      // Click on empty map deselects
      map.on("click", (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["neighborhoods-fill"],
        });
        if (features.length === 0) onSelect(null);
      });

      // Hover
      map.on("mousemove", "neighborhoods-fill", (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        const id = e.features?.[0]?.properties?.id as string | undefined;
        onHover(id ?? null);
      });
      map.on("mouseleave", "neighborhoods-fill", () => {
        map.getCanvas().style.cursor = "";
        onHover(null);
      });

      // POI popups
      map.on("click", "pois-circles", (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties ?? {};
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        let extra = "";
        if (props.type === "playground") {
          const shade = props.has_shade === true;
          const modern = props.modern_equipment === true;
          extra = `<div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
            <span style="background: ${shade ? "#FFF1D6" : "#F4F5F7"}; color: ${shade ? "#9C5A00" : "#84888E"}; padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 700;">
              ${shade ? "✓ הצללה" : "✗ ללא הצללה"}
            </span>
            <span style="background: ${modern ? "#E6F2EC" : "#F4F5F7"}; color: ${modern ? "#0E7C5A" : "#84888E"}; padding: 2px 6px; border-radius: 999px; font-size: 10px; font-weight: 700;">
              ${modern ? "✓ מתקנים מודרניים" : "מתקנים ישנים"}
            </span>
          </div>`;
        }
        const photoBlock = props.photo_url
          ? renderPhotoBlock({
              url: props.photo_url as string,
              title: (props.photo_title as string | null) ?? null,
              pageUrl: (props.photo_page_url as string | null) ?? null,
              license: (props.photo_license as string | null) ?? null,
              artist: (props.photo_artist as string | null) ?? null,
            })
          : "";
        new mapboxgl.Popup({ closeButton: true, offset: 10, maxWidth: "260px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: var(--font-heb); min-width: 190px; max-width: 240px; padding: 2px;">
               ${photoBlock}
               ${poiPopupHeader((props.type as string) ?? "", (props.name_he as string) ?? "")}
               ${extra}
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", "pois-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "pois-circles", () => {
        map.getCanvas().style.cursor = "";
      });

      initializedRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- React to data updates ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    const src = map.getSource("neighborhoods") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(neighborhoods);
  }, [neighborhoods]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    const src = map.getSource("pois") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(pois);
  }, [pois]);

  // ---- React to layer toggles ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    // Filter POI circles by active layer types.
    const types = Array.from(activeLayers).filter(
      (l) => l !== "price" && l !== "greenscore" && l !== "elections", // these are not POI types
    );
    map.setFilter("pois-circles", ["in", ["get", "type"], ["literal", types]]);

    // Elections layer recolors polygons by leading party. Fall back to the
    // baseline green for neighborhoods that have no results yet.
    const setFill = (map.setPaintProperty as unknown as (
      id: string,
      p: string,
      v: unknown,
    ) => void).bind(map);
    if (activeLayers.has("elections")) {
      setFill("neighborhoods-fill", "fill-color", [
        "case",
        ["has", "leading_party_color"],
        ["coalesce", ["get", "leading_party_color"], "#9BC97E"],
        "#9BC97E",
      ]);
      setFill("neighborhoods-fill", "fill-opacity", 0.55);
    } else {
      setFill("neighborhoods-fill", "fill-color", "#9BC97E");
      setFill("neighborhoods-fill", "fill-opacity", [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        0.55,
        13,
        0.50,
        15,
        0.40,
        17,
        0.25,
      ]);
    }
  }, [activeLayers]);

  // ---- React to selection / hover ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    map.setFilter("neighborhoods-stroke-selected", ["==", ["get", "id"], selected ?? ""]);

    // Fly to the selected polygon — but only when `selected` actually changed,
    // not on every `neighborhoods` recompute (e.g. persona change), so panning
    // away isn't undone by an unrelated state update.
    if (selected && selected !== lastFlownToRef.current) {
      const feature = neighborhoods.features.find((f) => f.properties.id === selected);
      const bbox = feature ? polygonBbox(feature.geometry) : null;
      if (bbox) {
        map.fitBounds(bbox, {
          padding: { top: 140, bottom: 220, left: 60, right: 60 },
          maxZoom: 15,
          duration: 700,
        });
      }
    }
    lastFlownToRef.current = selected;
  }, [selected, neighborhoods]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    map.setFilter("neighborhoods-stroke-hover", ["==", ["get", "id"], hover ?? ""]);
  }, [hover]);

  return <div ref={containerRef} className="mm-map-canvas" style={{ position: "absolute", inset: 0 }} />;
}

function renderPhotoBlock(p: {
  url: string;
  title: string | null;
  pageUrl: string | null;
  license: string | null;
  artist: string | null;
}): string {
  // Wikimedia attribution lines must include source + license + author (where
  // known). We render a compact strip with the photo on top and a small
  // "Photo: Wikipedia · CC BY-SA · J. Doe" line beneath it.
  const credits: string[] = [];
  if (p.title) {
    credits.push(
      p.pageUrl
        ? `<a href="${escapeHtml(p.pageUrl)}" target="_blank" rel="noopener noreferrer" style="color: #1256A0; text-decoration: none;">${escapeHtml(p.title)}</a>`
        : escapeHtml(p.title),
    );
  } else {
    credits.push("Wikipedia");
  }
  if (p.artist) credits.push(escapeHtml(p.artist));
  if (p.license) credits.push(escapeHtml(p.license));
  return `<div style="margin: 0 0 8px; border-radius: 6px; overflow: hidden; background: #F4F5F7;">
    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title ?? "")}" loading="lazy" style="width: 100%; height: 130px; object-fit: cover; display: block;" />
    <div style="padding: 4px 6px; font-size: 10px; color: #5B616E; line-height: 14px;">${credits.join(" · ")}</div>
  </div>`;
}

function polygonBbox(geom: GeoJSON.Polygon): [[number, number], [number, number]] | null {
  const ring = geom.coordinates?.[0];
  if (!ring || ring.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return null;
  return [[minX, minY], [maxX, maxY]];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

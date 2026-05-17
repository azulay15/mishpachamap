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
};

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
            `<div style="font-family: var(--font-heb); font-size: 12px; padding: 2px 4px;">
               ${photoBlock}
               <div style="font-weight: 700">${escapeHtml(props.name_he ?? "")}</div>
               <div style="color: #84888E; margin-top: 2px;">${escapeHtml(props.type ?? "")}</div>
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
      (l) => l !== "price" && l !== "greenscore", // these are not POI types
    );
    map.setFilter("pois-circles", ["in", ["get", "type"], ["literal", types]]);
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

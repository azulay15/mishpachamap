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
        new mapboxgl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: var(--font-heb); font-size: 12px; padding: 2px 4px;">
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
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;
    map.setFilter("neighborhoods-stroke-hover", ["==", ["get", "id"], hover ?? ""]);
  }, [hover]);

  return <div ref={containerRef} className="mm-map-canvas" style={{ position: "absolute", inset: 0 }} />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

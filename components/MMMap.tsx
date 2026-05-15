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
      style: "mapbox://styles/mapbox/light-v11",
      center: MODIIN_CENTER,
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Neighborhoods (fill + stroke)
      map.addSource("neighborhoods", { type: "geojson", data: neighborhoods });
      map.addLayer({
        id: "neighborhoods-fill",
        type: "fill",
        source: "neighborhoods",
        paint: {
          "fill-color": [
            "case",
            [">=", ["get", "match_score"], 90], "#007C32",
            [">=", ["get", "match_score"], 80], "#FF6B00",
            "#84888E",
          ],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "neighborhoods-stroke",
        type: "line",
        source: "neighborhoods",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "id"], ["literal", ""]], "#FF6B00", // selected (set per-tick below)
            "#84888E",
          ],
          "line-width": 1,
          "line-opacity": 0.5,
        },
      });
      map.addLayer({
        id: "neighborhoods-stroke-selected",
        type: "line",
        source: "neighborhoods",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#FF6B00",
          "line-width": 4,
        },
      });
      map.addLayer({
        id: "neighborhoods-stroke-hover",
        type: "line",
        source: "neighborhoods",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#181C21",
          "line-width": 2,
          "line-opacity": 0.6,
        },
      });

      // POIs
      map.addSource("pois", { type: "geojson", data: pois });
      map.addLayer({
        id: "pois-circles",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "type"],
            "school", LAYER_COLORS.school,
            "preschool", LAYER_COLORS.preschool,
            "park", LAYER_COLORS.park,
            "shop", LAYER_COLORS.shop,
            "transit", LAYER_COLORS.transit,
            "community", LAYER_COLORS.community,
            "celiac", LAYER_COLORS.celiac,
            /* default */ "#84888E",
          ],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
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
        new mapboxgl.Popup({ closeButton: true, offset: 10 })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: var(--font-heb); font-size: 12px; padding: 2px 4px;">
               <div style="font-weight: 700">${escapeHtml(props.name_he ?? "")}</div>
               <div style="color: #84888E; margin-top: 2px;">${escapeHtml(props.type ?? "")}</div>
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

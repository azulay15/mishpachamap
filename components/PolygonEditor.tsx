"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { NeighborhoodFeatureCollection } from "@/lib/geoData";
import { MMHeader } from "./MMHeader";
import { MMIcon } from "@/lib/icons";

const STORAGE_KEY = "mishpachamap.draw.v1";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  initial: NeighborhoodFeatureCollection;
};

export function PolygonEditor({ initial }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [features, setFeatures] = useState(initial.features);
  const [unsaved, setUnsaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Init map + draw once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [35.005, 31.9],
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw, "top-left");

    map.on("load", () => {
      // Merge strategy: take the canonical 14 features from `initial`. For
      // each, prefer the user's locally-edited version if one exists. So
      // when the canonical list grows (e.g. Moreshet added), the editor
      // immediately shows the new placeholder without discarding edits.
      let seed: NeighborhoodFeatureCollection["features"] = initial.features;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            features: NeighborhoodFeatureCollection["features"];
            savedAt: string;
          };
          if (parsed?.features?.length > 0) {
            const storedById = new Map(
              parsed.features
                .filter((f) => f?.properties?.id)
                .map((f) => [f.properties.id, f]),
            );
            seed = initial.features.map((f) => storedById.get(f.properties.id) ?? f);
            setLastSaved(parsed.savedAt);
          }
        }
      } catch {
        /* ignore */
      }

      for (const f of seed) {
        draw.add(f);
      }
      setFeatures(seed);
    });

    const onChange = () => {
      const fc = draw.getAll();
      setFeatures(fc.features as NeighborhoodFeatureCollection["features"]);
      setUnsaved(true);
    };
    map.on("draw.create", onChange);
    map.on("draw.update", onChange);
    map.on("draw.delete", onChange);
    map.on("draw.selectionchange", (e: unknown) => {
      const features = (e as { features?: GeoJSON.Feature[] }).features;
      const sel = features?.[0];
      setSelectedId((sel?.properties as { id?: string } | undefined)?.id ?? null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to localStorage when features change (debounced via setTimeout).
  useEffect(() => {
    if (!unsaved) return;
    const handle = setTimeout(() => {
      const savedAt = new Date().toISOString();
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ features, savedAt }),
        );
        setLastSaved(savedAt);
      } catch {
        /* quota or private mode — ignore */
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [features, unsaved]);

  const selectFeature = (id: string) => {
    const draw = drawRef.current;
    if (!draw) return;
    const feature = features.find((f) => f.properties.id === id);
    if (!feature) return;
    const fId = draw
      .getAll()
      .features.find((f) => (f.properties as { id?: string } | undefined)?.id === id)?.id;
    if (typeof fId === "string") {
      draw.changeMode("direct_select", { featureId: fId });
      setSelectedId(id);
      // Center map on the feature.
      const ring = (feature.geometry as GeoJSON.Polygon).coordinates[0];
      const lng = ring.reduce((s, [x]) => s + x, 0) / ring.length;
      const lat = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
    }
  };

  const downloadFile = () => {
    const fc: NeighborhoodFeatureCollection = {
      type: "FeatureCollection",
      ...(initial as { name?: string; meta?: unknown }),
      features,
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "neighborhoods.geo.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUnsaved(false);
  };

  const resetToInitial = () => {
    if (!confirm("לאפס את כל הפוליגונים לערכי ברירת המחדל? פעולה זו תמחק את עבודתך השמורה.")) return;
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    for (const f of initial.features) draw.add(f);
    setFeatures(initial.features);
    window.localStorage.removeItem(STORAGE_KEY);
    setLastSaved(null);
    setUnsaved(false);
  };

  return (
    <div className="mm-shell" style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
      <MMHeader activeNav="" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <main style={{ position: "relative", overflow: "hidden", background: "var(--map-bg)" }}>
          <div ref={containerRef} className="mm-map-canvas" style={{ position: "absolute", inset: 0 }} />
        </main>

        <aside
          style={{
            background: "#fff",
            borderInlineStart: "1px solid var(--stroke-weak)",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            overflow: "hidden",
          }}
        >
          <header style={{ padding: 16, borderBottom: "1px solid var(--stroke-weak)" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>עורך פוליגונים</h3>
            <div style={{ fontSize: 11, color: "var(--grey-500)", marginTop: 4, lineHeight: "16px" }}>
              לחצו על שכונה ברשימה כדי לעבור לעריכת הקודקודים שלה. גררו את הנקודות במפה לעיצוב המתאר.
            </div>
            {lastSaved && (
              <div style={{ fontSize: 10, color: "var(--grey-500)", marginTop: 6 }}>
                {unsaved ? "🟠 שינויים לא שמורים" : "✅"} נשמר אוטומטית: {new Date(lastSaved).toLocaleTimeString("he-IL")}
              </div>
            )}
          </header>

          <div className="mm-scroll" style={{ overflow: "auto", padding: "8px 12px" }}>
            {features.map((f) => {
              const id = f.properties.id;
              const isSelected = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectFeature(id)}
                  aria-pressed={isSelected}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "start",
                    padding: "8px 10px",
                    border: "1px solid",
                    borderColor: isSelected ? "var(--pumpkin-orange)" : "var(--stroke-weak)",
                    borderRadius: 6,
                    background: isSelected ? "rgba(255,107,0,0.06)" : "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--grey-900)" }}>
                    {f.properties.name_he}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--grey-500)",
                      fontFamily: "var(--font-inter, Inter)",
                    }}
                  >
                    {id} · {(f.geometry as GeoJSON.Polygon).coordinates[0].length - 1} קודקודים
                  </div>
                </button>
              );
            })}
          </div>

          <footer
            style={{
              padding: 12,
              borderTop: "1px solid var(--stroke-weak)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button type="button" onClick={downloadFile} className="mm-btn mm-btn-accent">
              <MMIcon name="external" size={14} color="#fff" />
              הורידו GeoJSON
            </button>
            <button type="button" onClick={resetToInitial} className="mm-btn mm-btn-ghost mm-btn-sm">
              איפוס לערכי ברירת מחדל
            </button>
            <p style={{ margin: 0, fontSize: 10, color: "var(--grey-500)", lineHeight: "14px" }}>
              אחרי ההורדה: החליפו את <code>public/neighborhoods.geo.json</code> בקובץ שירד, הריצו{" "}
              <code>npm run polygons:validate</code> ואז <code>npm run ingest:seed</code>.
            </p>
          </footer>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { LAYERS, type LayerId } from "@/lib/layers";
import { LayerChip } from "./LayerChip";
import { MMHeader } from "./MMHeader";
import { MMMap, type NeighborhoodFeatureProps, type POIFeatureProps } from "./MMMap";
import { MMMapStub } from "./MMMapStub";
import { NeighborhoodCard, type NeighborhoodCardData } from "./NeighborhoodCard";
import { ListingsPanel, type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { PersonaPill } from "./PersonaPill";
import { ScoreChip } from "./ScoreChip";
import { MMIcon } from "@/lib/icons";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { usePersona } from "@/lib/usePersona";

/** A neighborhood as the page server-fetched it, with the data needed to
 * compute the persona-aware match score on the client. `matchScore` here is
 * the server's default-persona score — clients with a custom persona
 * recompute it from `facts`. */
type ServerNeighborhood = NeighborhoodCardData & {
  polygon: GeoJSON.Polygon;
  center: GeoJSON.Position;
  facts: NeighborhoodFacts;
  /** Optional SVG-space data used only by MMMapStub. */
  svgPath?: string;
  svgCenter?: [number, number];
};

export type ConciergeData = {
  neighborhoods: ServerNeighborhood[];
  pois: GeoJSON.Feature<GeoJSON.Point, POIFeatureProps>[];
  listingsByNeighborhood: Record<string, ListingRow[]>;
  schoolsByNeighborhood: Record<string, SchoolRow[]>;
};

const INITIAL_LAYERS: LayerId[] = ["school", "park", "shop", "greenscore"];
const INITIAL_SELECTED = "hashvatim";

export function ConciergeScreen({
  data,
  renderer = "mapbox",
}: {
  data: ConciergeData;
  renderer?: "mapbox" | "stub";
}) {
  const [layers, setLayers] = useState<Set<LayerId>>(() => new Set(INITIAL_LAYERS));
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = new Set(data.neighborhoods.map((n) => n.id));
    if (ids.has(INITIAL_SELECTED)) return INITIAL_SELECTED;
    return data.neighborhoods[0]?.id ?? null;
  });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const persona = usePersona();

  // Recompute matchScore per current persona (vs. the server's default-persona score).
  const neighborhoodsWithScore = useMemo(
    () =>
      data.neighborhoods.map((n) => {
        const breakdown = breakdownFor(n.facts, persona);
        const score = Math.min(99, totalScore(breakdown));
        return { ...n, matchScore: score };
      }),
    [data.neighborhoods, persona],
  );

  const scoreById = useMemo(
    () => new Map(neighborhoodsWithScore.map((n) => [n.id, n.matchScore] as const)),
    [neighborhoodsWithScore],
  );

  const toggle = (id: LayerId) => {
    setLayers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortedCards = useMemo(
    () => [...neighborhoodsWithScore].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5),
    [neighborhoodsWithScore],
  );

  const selected = useMemo<Selected | null>(() => {
    const n = neighborhoodsWithScore.find((x) => x.id === selectedId);
    if (!n) return null;
    return {
      id: n.id,
      he: n.he,
      family: n.family,
      summary: n.summary,
      matchScore: n.matchScore,
      avgPrice: n.avgPrice,
      avgPriceDelta: n.avgPriceDelta,
      avgListing: n.avgListing,
      greenScore: n.greenScore,
      schoolScore: n.schoolScore,
    };
  }, [neighborhoodsWithScore, selectedId]);

  const neighborhoodsFC = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Polygon, NeighborhoodFeatureProps>
  >(
    () => ({
      type: "FeatureCollection",
      features: neighborhoodsWithScore.map((n) => ({
        type: "Feature",
        geometry: n.polygon,
        properties: { id: n.id, name_he: n.he, match_score: n.matchScore },
      })),
    }),
    [neighborhoodsWithScore],
  );

  // Listings need their containing-neighborhood's persona-aware score too.
  const listingsByNeighborhood = useMemo(() => {
    const out: Record<string, ListingRow[]> = {};
    for (const [nbId, rows] of Object.entries(data.listingsByNeighborhood)) {
      const score = scoreById.get(nbId) ?? 70;
      out[nbId] = rows.map((r) => ({ ...r, matchScore: score }));
    }
    return out;
  }, [data.listingsByNeighborhood, scoreById]);

  const poisFC = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, POIFeatureProps>>(
    () => ({ type: "FeatureCollection", features: data.pois }),
    [data.pois],
  );

  return (
    <div
      className="mm-shell"
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      <MMHeader activeNav="מפה" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gridTemplateRows: "100%",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <main style={{ position: "relative", overflow: "hidden", background: "var(--map-bg)" }}>
          {renderer === "mapbox" ? (
            <MMMap
              neighborhoods={neighborhoodsFC}
              pois={poisFC}
              activeLayers={layers}
              selected={selectedId}
              hover={hoverId}
              onSelect={setSelectedId}
              onHover={setHoverId}
            />
          ) : (
            <MMMapStub
              neighborhoods={neighborhoodsWithScore}
              pois={data.pois}
              activeLayers={layers}
              selected={selectedId}
              hover={hoverId}
              onSelect={setSelectedId}
              onHover={setHoverId}
            />
          )}

          {/* Search + persona pill (top-center) */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "flex",
              justifyContent: "center",
              gap: 8,
              padding: "0 16px",
            }}
          >
            <div
              className="mm-input"
              style={{
                width: 360,
                height: 40,
                boxShadow: "var(--shadow-md)",
                borderRadius: 999,
              }}
            >
              <MMIcon name="search" size={16} color="#84888E" />
              <input placeholder="חפשו: רחוב, שכונה, או 'בית עם גינה ובית ספר'" />
              <button
                className="mm-btn mm-btn-accent mm-btn-sm"
                style={{ height: 28, opacity: 0.55, cursor: "not-allowed" }}
                title="קונסיירז' AI · Phase 3 — בקרוב"
                disabled
              >
                <MMIcon name="sparkle" size={12} color="#fff" /> AI
              </button>
            </div>
            <PersonaPill />
          </div>

          {/* Layer pills */}
          <div
            style={{
              position: "absolute",
              top: 70,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "flex",
              justifyContent: "center",
              gap: 6,
              flexWrap: "wrap",
              padding: "0 16px",
            }}
          >
            {LAYERS.map((l) => (
              <LayerChip key={l.id} layer={l} on={layers.has(l.id)} onClick={() => toggle(l.id)} />
            ))}
          </div>

          {/* GreenScore corner badge */}
          {selected && (
            <div
              style={{
                position: "absolute",
                top: 16,
                insetInlineEnd: 16,
                zIndex: 4,
                background: "#fff",
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <ScoreChip value={selected.greenScore} color="var(--green-positive)" size="md" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{selected.he} · GreenScore</div>
                <div style={{ fontSize: 11, color: "var(--grey-500)" }}>אזור ירוק מהממוצע</div>
              </div>
            </div>
          )}

          {/* Bottom carousel */}
          <div
            className="mm-scroll"
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              right: 14,
              zIndex: 4,
              display: "flex",
              gap: 10,
              overflowX: "auto",
            }}
          >
            {sortedCards.map((n) => (
              <div key={n.id} style={{ flex: "0 0 280px" }}>
                <NeighborhoodCard
                  n={n}
                  selected={selectedId === n.id}
                  onClick={() => setSelectedId(n.id)}
                />
              </div>
            ))}
            <div
              className="mm-card"
              style={{
                flex: "0 0 200px",
                display: "grid",
                placeItems: "center",
                padding: 14,
                color: "var(--grey-700)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                borderStyle: "dashed",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <MMIcon name="plus" size={20} color="#5B616E" />
                <br />
                הציגו את כל השכונות
              </div>
            </div>
          </div>
        </main>

        <ListingsPanel
          selected={selected}
          listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
          schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
        />
      </div>
    </div>
  );
}

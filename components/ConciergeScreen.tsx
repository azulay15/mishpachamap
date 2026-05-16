"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LAYERS, type LayerId } from "@/lib/layers";
import { LayerChip } from "./LayerChip";
import { MMHeader } from "./MMHeader";
import { MMMap, type NeighborhoodFeatureProps, type POIFeatureProps } from "./MMMap";
import { MMMapStub } from "./MMMapStub";
import { NeighborhoodCard, type NeighborhoodCardData } from "./NeighborhoodCard";
import { type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { RightRail, type RailMode } from "./RightRail";
import { PersonaPill } from "./PersonaPill";
import { ScoreChip } from "./ScoreChip";
import { GreenScoreSheet } from "./GreenScoreSheet";
import { MatchBreakdownSheet } from "./MatchBreakdownSheet";
import { NeighborhoodSearch } from "./NeighborhoodSearch";
import { WelcomeCard } from "./WelcomeCard";
import { MobileRailDrawer } from "./MobileRailDrawer";
import { CompareSheet, type CompareItem } from "./CompareSheet";
import { useIsMobile } from "@/lib/useMediaQuery";
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
  /** Aliases for free-text search (Kaiser, Buchman, etc.). */
  aliases?: string[];
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
  const [greenSheetOpen, setGreenSheetOpen] = useState(false);
  const [matchSheetFor, setMatchSheetFor] = useState<string | null>(null);
  const [railMode, setRailMode] = useState<RailMode>("listings");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const persona = usePersona();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // Deep-link support: ?n=<id> selects that neighborhood on mount.
  useEffect(() => {
    const id = searchParams.get("n");
    if (!id) return;
    const ids = new Set(data.neighborhoods.map((nb) => nb.id));
    if (ids.has(id)) setSelectedId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) 380px",
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
            <NeighborhoodSearch
              neighborhoods={neighborhoodsWithScore.map((n) => ({
                id: n.id,
                he: n.he,
                family: n.family,
                aliases: n.aliases,
              }))}
              onPick={(id) => {
                setSelectedId(id);
                if (isMobile) setDrawerOpen(true);
              }}
              onAIClick={() => {
                setRailMode("ai");
                if (isMobile) setDrawerOpen(true);
              }}
            />
            <PersonaPill />
          </div>

          {/* Layer pills — horizontal scroll instead of wrap. Center-aligned
              when the row fits, free to scroll horizontally on narrow widths. */}
          <div
            className="mm-scroll"
            style={{
              position: "absolute",
              top: 70,
              left: 0,
              right: 0,
              zIndex: 4,
              overflowX: "auto",
              overflowY: "hidden",
              padding: "4px 16px 6px",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              maskImage:
                "linear-gradient(to inline-start, transparent, #000 16px, #000 calc(100% - 16px), transparent)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                gap: 6,
                whiteSpace: "nowrap",
                margin: "0 auto",
                paddingInlineStart: "max(0px, 50% - 380px)",
                paddingInlineEnd: "max(0px, 50% - 380px)",
              }}
            >
              {LAYERS.map((l) => (
                <LayerChip key={l.id} layer={l} on={layers.has(l.id)} onClick={() => toggle(l.id)} />
              ))}
            </div>
          </div>

          {/* GreenScore corner badge — clickable, opens breakdown sheet.
              Pushed lower on mobile so it doesn't crash into the layer pills row. */}
          {selected && (
            <button
              type="button"
              onClick={() => setGreenSheetOpen(true)}
              style={{
                position: "absolute",
                top: isMobile ? 116 : 16,
                insetInlineEnd: 16,
                zIndex: 4,
                background: "#fff",
                borderRadius: 8,
                padding: "10px 14px",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                gap: 10,
                alignItems: "center",
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              aria-label={`פתח פירוט GreenScore עבור ${selected.he}`}
            >
              <ScoreChip value={selected.greenScore} color="var(--green-positive)" size="md" />
              <div style={{ textAlign: "start" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{selected.he} · GreenScore</div>
                <div style={{ fontSize: 11, color: "var(--grey-500)" }}>
                  לחצו לפירוט 7 הרכיבים
                </div>
              </div>
            </button>
          )}

          {greenSheetOpen && selected && (
            <GreenScoreSheet
              neighborhoodHe={selected.he}
              score={selected.greenScore}
              onClose={() => setGreenSheetOpen(false)}
            />
          )}

          {matchSheetFor && (() => {
            const n = neighborhoodsWithScore.find((x) => x.id === matchSheetFor);
            if (!n) return null;
            return (
              <MatchBreakdownSheet
                neighborhoodHe={n.he}
                facts={n.facts}
                persona={persona}
                onClose={() => setMatchSheetFor(null)}
              />
            );
          })()}

          <WelcomeCard />

          {/* Floating compare CTA — appears when 2+ neighborhoods are in the
              compare set. Tap to open the side-by-side sheet. */}
          {compareIds.size >= 2 && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              style={{
                position: "absolute",
                bottom: 230,
                insetInlineEnd: 16,
                zIndex: 5,
                background: "var(--grey-900)",
                color: "#fff",
                border: 0,
                borderRadius: 999,
                padding: "10px 16px",
                cursor: "pointer",
                boxShadow: "var(--shadow-lg)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MMIcon name="compare" size={14} color="#fff" />
              השוו {compareIds.size} שכונות
            </button>
          )}

          {compareOpen && compareIds.size >= 2 && (
            <CompareSheet
              items={
                neighborhoodsWithScore.filter((n) => compareIds.has(n.id)) as unknown as CompareItem[]
              }
              persona={persona}
              onClose={() => setCompareOpen(false)}
              onRemove={(id) =>
                setCompareIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  if (next.size < 2) setCompareOpen(false);
                  return next;
                })
              }
            />
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
              <div key={n.id} style={{ flex: `0 0 ${isMobile ? 260 : 280}px` }}>
                <NeighborhoodCard
                  n={n}
                  selected={selectedId === n.id}
                  inCompare={compareIds.has(n.id)}
                  onToggleCompare={() => {
                    setCompareIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(n.id)) next.delete(n.id);
                      else if (next.size < 4) next.add(n.id);
                      return next;
                    });
                  }}
                  onClick={() => {
                    setSelectedId(n.id);
                    if (isMobile) setDrawerOpen(true);
                  }}
                  onExplainMatch={() => setMatchSheetFor(n.id)}
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

        {!isMobile && (
          <RightRail
            selected={selected}
            listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
            schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
            mode={railMode}
            onModeChange={setRailMode}
            onExplainMatch={selectedId ? () => setMatchSheetFor(selectedId) : undefined}
          />
        )}
        {isMobile && (
          <MobileRailDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            selected={selected}
            listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
            schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
            mode={railMode}
            onModeChange={setRailMode}
            onExplainMatch={selectedId ? () => setMatchSheetFor(selectedId) : undefined}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type LayerId } from "@/lib/layers";
import { LayersButton } from "./LayersButton";
import { MMHeader } from "./MMHeader";
import { MMMap, type NeighborhoodFeatureProps, type POIFeatureProps } from "./MMMap";
import { MMMapStub } from "./MMMapStub";
import { NeighborhoodCard, type NeighborhoodCardData } from "./NeighborhoodCard";
import { type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { type NeighborhoodElection } from "./ElectionsPanel";
import { RightRail, type RailMode } from "./RightRail";
import { NeighborhoodListRail, type NeighborhoodListItem } from "./NeighborhoodListRail";
import { NeighborhoodDetailsSheet } from "./NeighborhoodDetailsSheet";
import { PersonaPill } from "./PersonaPill";
import { ScoreChip } from "./ScoreChip";
import { GreenScoreSheet } from "./GreenScoreSheet";
import { MatchBreakdownSheet } from "./MatchBreakdownSheet";
import { NeighborhoodSearch } from "./NeighborhoodSearch";
import { WelcomeCard } from "./WelcomeCard";
import { MobileRailDrawer } from "./MobileRailDrawer";
import { CompareSheet, type CompareItem } from "./CompareSheet";
import { AllNeighborhoodsSheet, type AllNeighborhoodsItem } from "./AllNeighborhoodsSheet";
import { useIsMobile } from "@/lib/useMediaQuery";
import { MMIcon } from "@/lib/icons";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { usePersona } from "@/lib/usePersona";
import { useLayerPrefs } from "@/lib/useLayerPrefs";

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
  electionsByNeighborhood: Record<string, NeighborhoodElection>;
};

const INITIAL_LAYERS: LayerId[] = ["school", "park", "shop", "greenscore"];
const INITIAL_SELECTED = "hashvatim";

function ElectionsLegend({
  electionsByNeighborhood,
  isMobile,
}: {
  electionsByNeighborhood: Record<string, NeighborhoodElection>;
  isMobile: boolean;
}) {
  const leading = useMemo(() => {
    const map = new Map<string, { he: string; color: string; count: number }>();
    for (const e of Object.values(electionsByNeighborhood)) {
      const top = e.results[0];
      if (!top) continue;
      const prev = map.get(top.partyId);
      if (prev) prev.count += 1;
      else map.set(top.partyId, { he: top.partyHe, color: top.color, count: 1 });
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [electionsByNeighborhood]);

  if (leading.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        insetInlineStart: 16,
        // Below the top overlay row (which now wraps on narrow widths) on
        // mobile; otherwise just under it on desktop.
        top: isMobile ? 116 : 70,
        zIndex: 4,
        background: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "var(--shadow-md)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: 180,
      }}
      role="region"
      aria-label="מקרא: מפלגה מובילה לפי שכונה"
    >
      <div style={{ fontSize: 10, color: "var(--grey-500)", fontWeight: 700 }}>
        מפלגה מובילה
      </div>
      {leading.map((l) => (
        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span
            aria-hidden
            style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flex: "none" }}
          />
          <span style={{ flex: 1, fontWeight: 600, color: "var(--grey-900)" }}>{l.he}</span>
          <span style={{ color: "var(--grey-500)", fontFamily: "var(--font-inter, Inter)", fontVariantNumeric: "tabular-nums" }}>
            {l.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ConciergeScreen({
  data,
  renderer = "mapbox",
}: {
  data: ConciergeData;
  renderer?: "mapbox" | "stub";
}) {
  const { layers, toggle } = useLayerPrefs(INITIAL_LAYERS);
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
  const [allOpen, setAllOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const persona = usePersona();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const carouselRef = useRef<HTMLDivElement | null>(null);

  // When the selected neighborhood changes, scroll the carousel to bring the
  // matching card into view. Uses RAF so the DOM has settled after re-render.
  useEffect(() => {
    if (!selectedId) return;
    const id = requestAnimationFrame(() => {
      const container = carouselRef.current;
      if (!container) return;
      const card = container.querySelector<HTMLElement>(`[data-nb-id="${selectedId}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedId]);

  // Deep-link support: ?n=<id> selects that neighborhood on mount.
  useEffect(() => {
    const id = searchParams.get("n");
    if (!id) return;
    const ids = new Set(data.neighborhoods.map((nb) => nb.id));
    if (ids.has(id)) setSelectedId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Two-way URL sync: selection changes → reflect in `?n=<id>` without a
  // navigation, so the URL is shareable straight from the browser bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("n");
    if (selectedId && current !== selectedId) {
      url.searchParams.set("n", selectedId);
      window.history.replaceState(null, "", url.toString());
    } else if (!selectedId && current) {
      url.searchParams.delete("n");
      window.history.replaceState(null, "", url.toString());
    }
  }, [selectedId]);

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

  // Top 5 by match score, but always include the selected neighborhood so the
  // carousel visibly reflects what the user picked from search/sheet/map.
  const sortedCards = useMemo(() => {
    const ranked = [...neighborhoodsWithScore].sort((a, b) => b.matchScore - a.matchScore);
    const top = ranked.slice(0, 5);
    if (selectedId && !top.some((n) => n.id === selectedId)) {
      const sel = ranked.find((n) => n.id === selectedId);
      if (sel) return [sel, ...top.slice(0, 4)];
    }
    return top;
  }, [neighborhoodsWithScore, selectedId]);

  const selected = useMemo<Selected | null>(() => {
    const n = neighborhoodsWithScore.find((x) => x.id === selectedId);
    if (!n) return null;
    const [lng, lat] = n.center as [number, number];
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
      center: { lat, lng },
    };
  }, [neighborhoodsWithScore, selectedId]);

  const neighborhoodsFC = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Polygon, NeighborhoodFeatureProps>
  >(
    () => ({
      type: "FeatureCollection",
      features: neighborhoodsWithScore.map((n) => {
        const electionRow = data.electionsByNeighborhood[n.id];
        const top = electionRow?.results?.[0];
        return {
          type: "Feature",
          geometry: n.polygon,
          properties: {
            id: n.id,
            name_he: n.he,
            match_score: n.matchScore,
            leading_party_color: top?.color ?? null,
            leading_party_he: top?.partyHe ?? null,
          },
        };
      }),
    }),
    [neighborhoodsWithScore, data.electionsByNeighborhood],
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

          {/* Single overlay row: layers · search+AI · persona. Replaces the
              previous two-row layout (search + persona on top, full layer-chip
              row below) — fewer floating controls, all the same affordances. */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 16px",
              flexWrap: "wrap",
            }}
          >
            <LayersButton active={layers} onToggle={toggle} />
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

          {/* GreenScore corner badge — clickable, opens breakdown sheet.
              Lives in the bottom-start corner above the carousel so it
              doesn't compete with the top overlay row. */}
          {selected && (
            <button
              type="button"
              onClick={() => setGreenSheetOpen(true)}
              style={{
                position: "absolute",
                // Desktop has no bottom carousel, so the GreenScore badge sits
                // just above the map's bottom edge; mobile keeps the carousel
                // and the badge rides above it.
                bottom: isMobile ? 200 : 16,
                insetInlineStart: 16,
                zIndex: 4,
                background: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
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
              <ScoreChip value={selected.greenScore} color="var(--green-positive)" size="sm" />
              <div style={{ textAlign: "start" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{selected.he}</div>
                <div style={{ fontSize: 10, color: "var(--grey-500)" }}>
                  GreenScore · לחצו לפירוט
                </div>
              </div>
            </button>
          )}

          {/* Legend for the elections layer — lists the unique leading parties
              across visible neighborhoods, with their brand color. */}
          {layers.has("elections") && (
            <ElectionsLegend electionsByNeighborhood={data.electionsByNeighborhood} isMobile={isMobile} />
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
                // Same logic as the GreenScore badge — sits low on desktop
                // (no carousel), rides higher on mobile.
                bottom: isMobile ? 230 : 16,
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
              electionsByNeighborhood={data.electionsByNeighborhood}
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

          {allOpen && (
            <AllNeighborhoodsSheet
              items={neighborhoodsWithScore as unknown as AllNeighborhoodsItem[]}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                if (isMobile) setDrawerOpen(true);
              }}
              onClose={() => setAllOpen(false)}
            />
          )}

          {/* Bottom carousel — mobile only. Desktop shows all neighborhoods in
              the right rail instead, with a click-to-open details sheet for
              listings + AI. */}
          {isMobile && (
            <div
              ref={carouselRef}
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
                scrollBehavior: "smooth",
              }}
            >
              {sortedCards.map((n) => (
                <div key={n.id} data-nb-id={n.id} style={{ flex: `0 0 260px` }}>
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
                      setDrawerOpen(true);
                    }}
                    onExplainMatch={() => setMatchSheetFor(n.id)}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAllOpen(true)}
                className="mm-card"
                style={{
                  flex: "0 0 200px",
                  display: "grid",
                  placeItems: "center",
                  padding: 14,
                  color: "var(--grey-700)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  borderStyle: "dashed",
                  background: "transparent",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <MMIcon name="grid" size={20} color="#5B616E" />
                  <br />
                  כל {neighborhoodsWithScore.length} השכונות
                </div>
              </button>
            </div>
          )}
        </main>

        {!isMobile && (
          <NeighborhoodListRail
            items={neighborhoodsWithScore as unknown as NeighborhoodListItem[]}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            onOpenDetails={(id) => {
              setSelectedId(id);
              setDetailsOpen(true);
            }}
          />
        )}

        {!isMobile && detailsOpen && (
          <NeighborhoodDetailsSheet
            selected={selected}
            listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
            schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
            election={selectedId ? data.electionsByNeighborhood[selectedId] ?? null : null}
            mode={railMode}
            onModeChange={setRailMode}
            onExplainMatch={selectedId ? () => setMatchSheetFor(selectedId) : undefined}
            onClose={() => setDetailsOpen(false)}
          />
        )}
        {isMobile && (
          <MobileRailDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            selected={selected}
            listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
            schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
            election={selectedId ? data.electionsByNeighborhood[selectedId] ?? null : null}
            mode={railMode}
            onModeChange={setRailMode}
            onExplainMatch={selectedId ? () => setMatchSheetFor(selectedId) : undefined}
          />
        )}
      </div>
    </div>
  );
}

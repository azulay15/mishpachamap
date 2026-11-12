"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type LayerId } from "@/lib/layers";
import { LayersButton } from "./LayersButton";
import { MMHeader } from "./MMHeader";
import { MMMap, type NeighborhoodFeatureProps, type POIFeatureProps } from "./MMMap";
import { MMMapStub } from "./MMMapStub";
import { CitySwitcher } from "./CitySwitcher";
import { defaultCity, type City } from "@/lib/cities";
import { NeighborhoodCard, type NeighborhoodCardData } from "./NeighborhoodCard";
import { type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { type NeighborhoodElection } from "./ElectionsPanel";
import { RightRail, type RailMode } from "./RightRail";
import { NeighborhoodListRail, type NeighborhoodListItem } from "./NeighborhoodListRail";
import { PersonaPill } from "./PersonaPill";
import { priceContext } from "./PriceFilterBar";
import { ScoreChip } from "./ScoreChip";
import { GreenScoreSheet } from "./GreenScoreSheet";
import { MatchBreakdownSheet } from "./MatchBreakdownSheet";
import { NeighborhoodSearch } from "./NeighborhoodSearch";
import { WelcomeCard } from "./WelcomeCard";
import { MobileRailDrawer } from "./MobileRailDrawer";
import { MobileTabBar } from "./MobileTabBar";
import { NeighborhoodPeek } from "./NeighborhoodPeek";
import { rememberCity } from "@/lib/lastCity";
import { CompareSheet, type CompareItem } from "./CompareSheet";
import { AllNeighborhoodsSheet, type AllNeighborhoodsItem } from "./AllNeighborhoodsSheet";
import { useIsMobile } from "@/lib/useMediaQuery";
import { MMIcon } from "@/lib/icons";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { type Demographics, type Safety } from "@/lib/staticData";
import { usePersona, writePersona } from "@/lib/usePersona";
import { filterPrice, hasDeal, passesFilter, priceLabel, type Market, type PriceFilter, type RoomKey } from "@/lib/market";
import { useLayerPrefs } from "@/lib/useLayerPrefs";
import { SCORE_STEPS } from "@/lib/theme";

/** A neighborhood as the page server-fetched it, with the data needed to
 * compute the persona-aware match score on the client. `matchScore` here is
 * the server's default-persona score — clients with a custom persona
 * recompute it from `facts`. */
type ServerNeighborhood = NeighborhoodCardData & {
  polygon: GeoJSON.Polygon;
  center: GeoJSON.Position;
  facts: NeighborhoodFacts;
  /** Rent + sale prices by apartment size. Null = the source has none here. */
  market?: Market | null;
  /** Aliases for free-text search (Kaiser, Buchman, etc.). */
  aliases?: string[];
  /** Real per-neighborhood enrichment (CBS census / Police). Null = no coverage. */
  demographics?: Demographics | null;
  safety?: Safety | null;
  /** Optional SVG-space data used only by MMMapStub. */
  svgPath?: string;
  svgCenter?: [number, number];
};

export type ConciergeData = {
  neighborhoods: ServerNeighborhood[];
  /** City-wide rent + sale prices by apartment size, for context. */
  cityMarket?: Market | null;
  /** The price source's own "updated" stamp (dd-mm-yyyy). */
  marketVersion?: string | null;
  pois: GeoJSON.Feature<GeoJSON.Point, POIFeatureProps>[];
  listingsByNeighborhood: Record<string, ListingRow[]>;
  schoolsByNeighborhood: Record<string, SchoolRow[]>;
  electionsByNeighborhood: Record<string, NeighborhoodElection>;
};

const INITIAL_LAYERS: LayerId[] = ["school", "park", "shop"];
const INITIAL_SELECTED = "hashvatim";

/** Mobile bottom-carousel geometry. The floating badges above the carousel are
 *  positioned from these, so they can't drift apart again. */
const CAROUSEL_CARD_H = 128;
const CAROUSEL_BOTTOM = "calc(14px + env(safe-area-inset-bottom, 0px))";
const ABOVE_CAROUSEL = `calc(${14 + CAROUSEL_CARD_H + 12}px + env(safe-area-inset-bottom, 0px))`;

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

/** Key for the map's green ramp: polygons are shaded by family-match score. */
function MatchLegend() {
  const labels = [`עד ${SCORE_STEPS[0]}`, ...SCORE_STEPS.map((t) => `${t}+`)];
  return (
    <div
      role="img"
      aria-label={`מקרא: צבע השכונה לפי ציון ההתאמה, ${labels.join(", ")}`}
      style={{
        position: "absolute",
        insetInlineEnd: 16,
        bottom: 44,
        zIndex: 4,
        background: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "var(--shadow-md)",
        fontSize: 10,
        color: "var(--grey-700)",
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--grey-500)", marginBottom: 5 }}>צבע = ציון התאמה למשפחה</div>
      <div style={{ display: "flex", gap: 2 }}>
        {labels.map((label, i) => (
          <div key={label} style={{ flex: 1, minWidth: 30, textAlign: "center" }}>
            <div style={{ height: 8, borderRadius: 2, background: `var(--hn-score-${i + 1})`, border: "1px solid var(--stroke-weak)" }} />
            <div style={{ marginTop: 3, fontFamily: "var(--font-inter, Inter)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConciergeScreen({
  data,
  renderer = "mapbox",
  city = defaultCity(),
  initialSelected,
}: {
  data: ConciergeData;
  renderer?: "mapbox" | "stub";
  city?: City;
  /** Neighborhood id to pre-select (from the server-read `?n=` deep link).
   *  Seeding the initial state here avoids the mount-time race where the URL
   *  sync would overwrite `?n` before the client deep-link effect applied it. */
  initialSelected?: string;
}) {
  const { layers, toggle } = useLayerPrefs(INITIAL_LAYERS);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = new Set(data.neighborhoods.map((n) => n.id));
    if (initialSelected && ids.has(initialSelected)) return initialSelected;
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
  // Phones: the short sheet shown after tapping a neighborhood on the map.
  const [peekOpen, setPeekOpen] = useState(false);
  const persona = usePersona();
  // Price filter: buy/rent follows the family profile (so the match score and
  // the prices shown always talk about the same thing); size + ceiling are
  // browsing state.
  const [priceRooms, setPriceRooms] = useState<RoomKey>("all");
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const priceFilter = useMemo<PriceFilter>(
    () => ({ deal: persona.deal, rooms: priceRooms, max: priceMax }),
    [persona.deal, priceRooms, priceMax],
  );
  const setPriceFilter = (next: PriceFilter) => {
    setPriceRooms(next.rooms);
    setPriceMax(next.max);
    if (next.deal !== persona.deal) writePersona({ ...persona, deal: next.deal });
  };
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

  // Remember this city so `/map` and Home come back to it (server-read cookie).
  useEffect(() => {
    rememberCity(city.slug);
  }, [city.slug]);

  // `?view=list|ai` (header nav / tab bar links from other pages) opens the
  // matching panel once, then is dropped from the URL.
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (!view) return;
    const phone = window.matchMedia("(max-width: 768px)").matches;
    if (view === "ai") {
      setRailMode("ai");
      if (phone) setDrawerOpen(true);
    } else if (view === "list" && phone) {
      setAllOpen(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState(null, "", url.toString());
  }, []);

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

  /** Add / remove a neighborhood from the comparison set (max 4). */
  const toggleCompare = (id: string) =>
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });

  // Recompute matchScore per current persona (vs. the server's default-persona score).
  const neighborhoodsWithScore = useMemo(
    () =>
      data.neighborhoods.map((n) => {
        const breakdown = breakdownFor(n.facts, persona);
        const score = Math.min(99, totalScore(breakdown));
        const price = filterPrice(n, priceFilter);
        return { ...n, matchScore: score, price, fits: passesFilter(price, priceFilter) };
      }),
    [data.neighborhoods, persona, priceFilter],
  );

  const priceAvailable = useMemo(
    () => ({ buy: hasDeal(data.neighborhoods, "buy"), rent: hasDeal(data.neighborhoods, "rent") }),
    [data.neighborhoods],
  );

  const scoreById = useMemo(
    () => new Map(neighborhoodsWithScore.map((n) => [n.id, n.matchScore] as const)),
    [neighborhoodsWithScore],
  );

  // Top 5 by match score, but always include the selected neighborhood so the
  // carousel visibly reflects what the user picked from search/sheet/map.
  const sortedCards = useMemo(() => {
    const ranked = [...neighborhoodsWithScore].sort((a, b) => b.matchScore - a.matchScore);
    // The price ceiling applies to the carousel too.
    const top = ranked.filter((n) => n.fits).slice(0, 5);
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
      market: n.market ?? null,
      cityMarket: data.cityMarket ?? null,
      marketVersion: data.marketVersion ?? null,
      greenScore: n.greenScore,
      schoolScore: n.schoolScore,
      demographics: n.demographics ?? null,
      safety: n.safety ?? null,
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
            dim: !n.fits,
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
      className="mm-shell mm-fullscreen"
      // Per-city language/direction: Israeli cities are he/RTL (the app default);
      // international cities (NYC) render en/LTR. The CSS uses logical
      // properties (insetInlineStart etc.), so the layout re-flows for free.
      dir={city.dir ?? "rtl"}
      lang={city.lang ?? "he"}
      style={{
        display: "grid",
        // header · map · (phones) tab bar — the tab bar is display:none on
        // desktop, so its row collapses to nothing there.
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        overflow: "hidden",
      }}
    >
      <MMHeader activeNav="מפה" />
      <div
        style={{
          display: "grid",
          // RTL: column 1 = visual right (NeighborhoodListRail / all neighborhoods),
          // column 2 = center map, column 3 = visual left (RightRail / Listings+AI).
          // Mobile collapses to single column; the rails surface via the bottom
          // carousel + drawer.
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "340px minmax(0, 1fr) clamp(360px, 27vw, 440px)",
          gridTemplateRows: "100%",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {!isMobile && (
          <NeighborhoodListRail
            items={neighborhoodsWithScore as unknown as NeighborhoodListItem[]}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            cityName={city.name_he}
            priceFilter={priceFilter}
            onPriceFilter={setPriceFilter}
            priceAvailable={priceAvailable}
            hoverId={hoverId}
            onHover={setHoverId}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
          />
        )}
        <main style={{ position: "relative", overflow: "hidden", background: "var(--map-bg)" }}>
          {renderer === "mapbox" ? (
            <MMMap
              neighborhoods={neighborhoodsFC}
              pois={poisFC}
              activeLayers={layers}
              selected={selectedId}
              hover={hoverId}
              onSelect={(id) => {
                setSelectedId(id);
                // Phones: a map tap opens the short peek sheet (or closes it
                // when the tap lands outside every neighborhood).
                if (isMobile) setPeekOpen(id !== null);
              }}
              onHover={setHoverId}
              center={city.center}
              zoom={city.zoom}
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
              top: isMobile ? 10 : 16,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: isMobile ? "0 12px" : "0 16px",
              flexWrap: "wrap",
            }}
          >
            <CitySwitcher city={city} />
            <LayersButton active={layers} onToggle={toggle} />
            {/* Phones get exactly two rows whatever the city name's length:
                city · layers, then search · profile. */}
            {isMobile && <div aria-hidden style={{ order: 2, flex: "0 0 100%", height: 0, marginTop: -8 }} />}
            <div
              style={
                isMobile
                  ? { order: 3, flex: "1 1 0", minWidth: 0, display: "flex" }
                  : { display: "contents" }
              }
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
            </div>
            <div style={isMobile ? { order: 4, flex: "none" } : { display: "contents" }}>
              <PersonaPill />
            </div>
          </div>

          {/* GreenScore corner badge — clickable, opens breakdown sheet.
              Lives in the bottom-start corner above the carousel so it
              doesn't compete with the top overlay row. */}
          {selected && !(isMobile && peekOpen) && (
            <button
              type="button"
              onClick={() => setGreenSheetOpen(true)}
              style={{
                position: "absolute",
                // Desktop has no bottom carousel, so the GreenScore badge sits
                // just above the map's bottom edge; mobile keeps the carousel
                // and the badge rides above it.
                bottom: isMobile ? ABOVE_CAROUSEL : 16,
                insetInlineStart: isMobile ? 12 : 16,
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

          {/* What the polygon colours mean — desktop only (phones have no
              room, and the cards carry the score). Hidden while the elections
              layer recolours the map. */}
          {!isMobile && !layers.has("elections") && <MatchLegend />}

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

          {!(isMobile && peekOpen) && <WelcomeCard />}

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
                bottom: isMobile ? ABOVE_CAROUSEL : 16,
                ...(isMobile
                  ? { insetInlineEnd: 12 }
                  : { left: "50%", transform: "translateX(-50%)" }),
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
              cityName={city.name_he}
              priceFilter={priceFilter}
              onPriceFilter={setPriceFilter}
              priceAvailable={priceAvailable}
            />
          )}

          {/* Bottom carousel — mobile only. Desktop shows all neighborhoods in
              the right rail instead, with a click-to-open details sheet for
              listings + AI. */}
          {isMobile && peekOpen && selected && (() => {
            const n = neighborhoodsWithScore.find((x) => x.id === selected.id);
            if (!n) return null;
            return (
              <NeighborhoodPeek
                id={n.id}
                he={n.he}
                family={n.family}
                matchScore={n.matchScore}
                greenScore={n.greenScore}
                priceText={n.price != null ? `${priceContext(priceFilter)} ${priceLabel(n.price, priceFilter.deal)}` : null}
                breakdown={breakdownFor(n.facts, persona)}
                onExpand={() => {
                  setPeekOpen(false);
                  setRailMode("listings");
                  setDrawerOpen(true);
                }}
                onClose={() => setPeekOpen(false)}
                onExplainMatch={() => setMatchSheetFor(n.id)}
              />
            );
          })()}

          {isMobile && !peekOpen && (
            <div
              ref={carouselRef}
              className="mm-scroll"
              style={{
                position: "absolute",
                bottom: CAROUSEL_BOTTOM,
                left: 0,
                right: 0,
                // Edge-to-edge scroller with inner padding, so the next card
                // peeks in from the screen edge instead of being clipped.
                padding: "4px 12px",
                scrollPaddingInline: 12,
                zIndex: 4,
                display: "flex",
                gap: 10,
                overflowX: "auto",
                scrollBehavior: "smooth",
                scrollbarWidth: "none",
              }}
            >
              {sortedCards.map((n) => (
                <div key={n.id} data-nb-id={n.id} style={{ flex: "0 0 min(76vw, 280px)", height: CAROUSEL_CARD_H }}>
                  <NeighborhoodCard
                    n={n}
                    compact
                    priceStat={
                      n.price != null
                        ? { value: priceLabel(n.price, priceFilter.deal), label: priceContext(priceFilter) }
                        : undefined
                    }
                    selected={selectedId === n.id}
                    inCompare={compareIds.has(n.id)}
                    onToggleCompare={() => toggleCompare(n.id)}
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
                  flex: "0 0 150px",
                  height: CAROUSEL_CARD_H,
                  display: "grid",
                  placeItems: "center",
                  padding: 14,
                  color: "var(--grey-700)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  borderStyle: "dashed",
                  background: "rgba(255,255,255,0.85)",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <MMIcon name="grid" size={20} color="var(--hn-text-2)" />
                  <br />
                  כל {neighborhoodsWithScore.length} השכונות
                </div>
              </button>
            </div>
          )}
        </main>

        {!isMobile && (
          <RightRail
            selected={selected}
            listings={selectedId ? listingsByNeighborhood[selectedId] ?? [] : []}
            schools={selectedId ? data.schoolsByNeighborhood[selectedId] ?? [] : []}
            election={selectedId ? data.electionsByNeighborhood[selectedId] ?? null : null}
            mode={railMode}
            onModeChange={setRailMode}
            onExplainMatch={selectedId ? () => setMatchSheetFor(selectedId) : undefined}
            city={city}
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
            city={city}
          />
        )}
      </div>
      <MobileTabBar
        active={allOpen ? "list" : drawerOpen && railMode === "ai" ? "ai" : "map"}
        onMap={() => {
          setAllOpen(false);
          setDrawerOpen(false);
        }}
        onList={() => {
          setDrawerOpen(false);
          setPeekOpen(false);
          setAllOpen(true);
        }}
        onAI={() => {
          setAllOpen(false);
          setPeekOpen(false);
          setRailMode("ai");
          setDrawerOpen(true);
        }}
      />
    </div>
  );
}

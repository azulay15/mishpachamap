/**
 * Server-side data assembly shared by the map page (`/map`) and the home page
 * (`/`). Extracted verbatim from the former `app/page.tsx` so both routes read
 * the exact same Supabase queries + join logic; geometry still comes from the
 * static GeoJSON file (see lib/geoData.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConciergeData } from "@/components/ConciergeScreen";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { PERSONA_DEFAULT } from "@/lib/persona";
import { loadNeighborhoodFeatures, centroidOf, type NeighborhoodFeatureCollection } from "@/lib/geoData";
import { loadDemographics, loadSafety, loadSchools, loadTransitStops, loadEnvironment, loadPrices, type StaticSchool } from "@/lib/staticData";
import { defaultCity, type City } from "@/lib/cities";

type NeighborhoodRow = {
  id: string;
  name_he: string;
  family_label: string | null;
  summary_he: string | null;
  aliases: string[] | null;
};

type MetricsRow = {
  neighborhood: string;
  avg_price_per_m2: number | null;
  avg_price_yoy_pct: number | null;
  avg_listing_price: number | null;
  green_score: number | null;
  school_score: number | null;
  quiet_score: number | null;
};

type ListingDB = {
  id: string;
  neighborhood: string | null;
  address: string | null;
  price_nis: number | null;
  price_per_m2: number | null;
  rooms: number | null;
  sqm: number | null;
  garden_sqm: number | null;
  status_he: string | null;
  days_on_market: number | null;
};

type ElectionRow = { id: string; name_he: string; date: string };
type PartyRow = { id: string; name_he: string; color: string | null };
type ResultRow = {
  neighborhood: string;
  election: string;
  party: string;
  votes: number;
  pct: number | null;
};

type POIDB = {
  id: string;
  type: string;
  name_he: string | null;
  point: GeoJSON.Point;
  meta: Record<string, unknown> | null;
};

/**
 * Run the standard Concierge queries for one city and assemble the client
 * payload.
 *
 * Geo-first: the neighborhood list is driven by the city's static polygon file,
 * NOT the DB — so a city with real polygons + static enrichment renders fully
 * even when it has zero rows in Supabase (e.g. a newly-added city whose prices/
 * POIs/elections haven't been seeded). The DB only *enriches* neighborhoods
 * whose ids match. Returns null only when the city has no polygons at all
 * (unbuilt "coming-soon" city) — callers then show a teaser/mock, as before.
 *
 * All DB queries are scoped to this city: per-neighborhood tables by id, and
 * POIs (which carry no city key) by the city's bounding box, so a multi-city
 * database never leaks one city's points onto another's map.
 */
export async function fetchConciergeData(
  sb: SupabaseClient,
  city: City = defaultCity(),
): Promise<ConciergeData | null> {
  const geoFeatures = loadNeighborhoodFeatures(city);
  if (geoFeatures.features.length === 0) return null;
  const ids = geoFeatures.features.map((f) => f.properties.id);
  const bbox = bboxOf(geoFeatures);

  // Schools no longer come from the DB (`schools_geojson` was OSM-derived, 70%
  // wrong, and its 0003-migration columns don't exist). They're loaded from the
  // authoritative MoE static file in assemble() instead.
  const [
    { data: nb },
    { data: metrics },
    { data: pois },
    { data: listings },
    { data: elections },
    { data: parties },
    { data: electionResults },
  ] = await Promise.all([
    sb.from("neighborhoods").select("id, name_he, family_label, summary_he, aliases").in("id", ids),
    sb.from("neighborhood_metrics").select("*").in("neighborhood", ids),
    // POIs have no city column — scope by the city's bbox (filtered in JS below).
    sb.from("pois_geojson").select("id, type, name_he, point, meta"),
    sb.from("listings").select("id, neighborhood, address, price_nis, price_per_m2, rooms, sqm, garden_sqm, status_he, days_on_market").in("neighborhood", ids),
    // elections + parties are global reference tables (not per-neighborhood).
    sb.from("elections").select("id, name_he, date").order("date", { ascending: false }),
    sb.from("parties").select("id, name_he, color"),
    sb.from("neighborhood_election_results").select("neighborhood, election, party, votes, pct").in("neighborhood", ids),
  ]);

  const poisInCity = ((pois ?? []) as POIDB[]).filter((p) => p.point && inBbox(p.point.coordinates as [number, number], bbox));

  return assemble({
    city,
    geoFeatures,
    nb: (nb ?? []) as NeighborhoodRow[],
    metrics: (metrics ?? []) as MetricsRow[],
    pois: poisInCity,
    listings: (listings ?? []) as ListingDB[],
    elections: (elections ?? []) as ElectionRow[],
    parties: (parties ?? []) as PartyRow[],
    electionResults: (electionResults ?? []) as ResultRow[],
  });
}

/** [minLng, minLat, maxLng, maxLat] over all polygon vertices, +~1km margin. */
function bboxOf(fc: NeighborhoodFeatureCollection): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const f of fc.features) {
    for (const ring of f.geometry.coordinates) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  const M = 0.01; // ~1km
  return [minLng - M, minLat - M, maxLng + M, maxLat + M];
}

function inBbox([lng, lat]: [number, number], [minLng, minLat, maxLng, maxLat]: [number, number, number, number]): boolean {
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

function assemble(input: {
  city: City;
  geoFeatures: NeighborhoodFeatureCollection;
  nb: NeighborhoodRow[];
  metrics: MetricsRow[];
  pois: POIDB[];
  listings: ListingDB[];
  elections: ElectionRow[];
  parties: PartyRow[];
  electionResults: ResultRow[];
}): ConciergeData {
  const metricsByNb = new Map(input.metrics.map((m) => [m.neighborhood, m]));
  const persona = PERSONA_DEFAULT;

  // Real enrichment from THIS city's static files (CBS census, Police, MoE).
  const demographics = loadDemographics(input.city);
  const safety = loadSafety(input.city);
  const schools = loadSchools(input.city);
  // Green/quiet: prefer the city's static environment file; fall back to the DB
  // metrics below (Modi'in's legacy path, until it too has a static file).
  const environment = loadEnvironment(input.city);
  // Sale prices: prefer the city's static prices file; fall back to DB metrics.
  const prices = loadPrices(input.city);

  // Step 1 — build base neighborhood records (no matchScore yet), GEO-FIRST:
  // every polygon in the city's static file is a neighborhood; DB rows only
  // enrich (editorial copy + metrics) where the id matches. Names fall back to
  // the geo file, so a city with no DB rows still renders with real names.
  const nbById = new Map(input.nb.map((n) => [n.id, n]));
  const base = input.geoFeatures.features.map((feature) => {
    const id = feature.properties.id;
    const n = nbById.get(id);
    const center = centroidOf(feature);
    const m = metricsByNb.get(id);
    const env = environment[id];
    const pr = prices[id];
    return {
      id,
      he: n?.name_he ?? feature.properties.name_he,
      family: n?.family_label ?? null,
      summary: n?.summary_he ?? null,
      polygon: feature.geometry,
      center,
      aliases: n?.aliases ?? [],
      avgPrice: pr?.avg_price_per_m2 ?? m?.avg_price_per_m2 ?? 0,
      avgPriceDelta: Number(pr?.avg_price_yoy_pct ?? m?.avg_price_yoy_pct ?? 0),
      avgListing: Number(pr?.avg_listing_price ?? m?.avg_listing_price ?? 0),
      greenScore: env?.green_score ?? m?.green_score ?? 0,
      schoolScore: m?.school_score ?? 0,
      quietScore: env?.quiet_score ?? m?.quiet_score ?? 70,
      demographics: demographics[id] ?? null,
      safety: safety[id] ?? null,
    };
  });

  // Step 2 — POIs as GeoJSON Features.
  const pois = input.pois
    .filter((p) => p.point)
    .map((p) => {
      const meta = p.meta ?? {};
      // Mapbox vector properties must be primitives, not nested objects —
      // so we flatten the photo metadata into top-level optional fields.
      const photo_url = typeof meta.photo_url === "string" ? (meta.photo_url as string) : null;
      const photo_title = typeof meta.photo_title === "string" ? (meta.photo_title as string) : null;
      const photo_page_url = typeof meta.photo_page_url === "string" ? (meta.photo_page_url as string) : null;
      const photo_license = typeof meta.photo_license === "string" ? (meta.photo_license as string) : null;
      const photo_artist = typeof meta.photo_artist === "string" ? (meta.photo_artist as string) : null;
      const has_shade = meta.has_shade === true ? true : null;
      const modern_equipment = meta.modern_equipment === true ? true : null;
      return {
        type: "Feature" as const,
        geometry: p.point,
        properties: {
          id: p.id,
          type: p.type as never,
          name_he: p.name_he,
          photo_url,
          photo_title,
          photo_page_url,
          photo_license,
          photo_artist,
          has_shade,
          modern_equipment,
        },
      };
    });

  // Step 3 — group listings by neighborhood (matchScore filled in after we compute it).
  const listingRowsByNb: Record<string, Omit<ConciergeData["listingsByNeighborhood"][string][number], "matchScore">[]> = {};
  for (const l of input.listings) {
    if (!l.neighborhood) continue;
    (listingRowsByNb[l.neighborhood] ??= []).push({
      id: l.id,
      address: l.address ?? "",
      price_nis: Number(l.price_nis ?? 0),
      price_per_m2: l.price_per_m2 ?? 0,
      rooms: Number(l.rooms ?? 0),
      sqm: Number(l.sqm ?? 0),
      garden_sqm: l.garden_sqm,
      status_he: l.status_he,
      days_on_market: l.days_on_market,
    });
  }

  // Step 4 — assign schools to neighborhoods within 1km walking distance of each neighborhood center.
  // A school may appear in multiple neighborhoods (overlapping rectangles in V1).
  const WALK_M = 1200;
  const schoolsByNeighborhood: Record<string, ConciergeData["schoolsByNeighborhood"][string]> = {};
  for (const n of base) {
    const nearby: ConciergeData["schoolsByNeighborhood"][string] = [];
    for (const s of schools) {
      if (s.lon == null || s.lat == null) continue;
      const d = haversineMeters(n.center, [s.lon, s.lat]);
      if (d > WALK_M) continue;
      nearby.push({
        id: `moe-${s.semel}`,
        name_he: s.name_he,
        meitzav_score: s.meitzav_score,
        walkMinutes: Math.max(1, Math.round(d / 80)),
        level: s.level,
        orientation: s.supervision, // ממלכתי / ממ"ד / חרדי — the religious orientation
        bagrutPassRate: null, // MoE data has offers-bagrut (bool), not a pass rate
        studentCount: s.students,
        websiteUrl: null,
      });
    }
    nearby.sort((a, b) => (a.walkMinutes ?? 99) - (b.walkMinutes ?? 99));
    if (nearby.length > 0) schoolsByNeighborhood[n.id] = nearby;
  }

  // Step 5 — compute facts per neighborhood, plus a server-side matchScore
  // using the default persona. The client may recompute matchScore using the
  // user's actual persona from localStorage.
  const neighborhoods = base.map((n) => {
    const facts: NeighborhoodFacts = {
      id: n.id,
      avgListing: n.avgListing > 0 ? n.avgListing : null,
      gardenAvailability: gardenShare(listingRowsByNb[n.id] ?? []),
      schoolWalkMeters: nearestSchoolMeters(n.center, schools),
      parkMeters: nearestPOIMeters(n.center, input.pois, "park"),
      shopMeters: nearestPOIMeters(n.center, input.pois, "shop"),
      transitMeters: nearestPOIMeters(n.center, input.pois, "transit"),
      quietScore: n.quietScore,
      greenScore: n.greenScore,
      celiacDistance: nearestPOIMeters(n.center, input.pois, "celiac"),
      celiacDensity: poisWithinMeters(n.center, input.pois, "celiac", 1000),
    };
    const breakdown = breakdownFor(facts, persona);
    const score = Math.min(99, totalScore(breakdown));
    return { ...n, facts, matchScore: score };
  });

  // Step 6 — fill in placeholder matchScore on listings (client overrides per-persona).
  const scoreByNb = new Map(neighborhoods.map((n) => [n.id, n.matchScore] as const));
  const listingsByNeighborhood: Record<string, ConciergeData["listingsByNeighborhood"][string]> = {};
  for (const [nbId, rows] of Object.entries(listingRowsByNb)) {
    listingsByNeighborhood[nbId] = rows.map((r) => ({
      ...r,
      matchScore: scoreByNb.get(nbId) ?? 70,
    }));
  }

  // Step 7 — build per-neighborhood election summary (most recent election
  // only, results sorted desc by votes, party metadata joined). UI shows top
  // 5 + "אחרים" so we keep all rows here and let the component decide.
  const electionsById = new Map(input.elections.map((e) => [e.id, e]));
  const partiesById = new Map(input.parties.map((p) => [p.id, p]));
  const latestElectionId = input.elections[0]?.id ?? null;
  const electionsByNeighborhood: ConciergeData["electionsByNeighborhood"] = {};
  if (latestElectionId) {
    const meta = electionsById.get(latestElectionId)!;
    const grouped: Record<string, ConciergeData["electionsByNeighborhood"][string]["results"]> = {};
    for (const r of input.electionResults) {
      if (r.election !== latestElectionId) continue;
      const p = partiesById.get(r.party);
      if (!p) continue; // unknown party id — skip rather than show a blank
      (grouped[r.neighborhood] ??= []).push({
        partyId: p.id,
        partyHe: p.name_he,
        color: p.color ?? "#84888E",
        votes: r.votes,
        pct: Number(r.pct ?? 0),
      });
    }
    for (const [nbId, results] of Object.entries(grouped)) {
      results.sort((a, b) => b.votes - a.votes);
      electionsByNeighborhood[nbId] = {
        electionId: meta.id,
        electionHe: meta.name_he,
        date: meta.date,
        results,
      };
    }
  }

  // Schools as map POIs (type "school") so the "בתי ספר" map layer shows real
  // dots — using the authoritative MoE locations, colour + icon already defined.
  const schoolPois = schools
    .filter((s) => s.lon != null && s.lat != null)
    .map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lon as number, s.lat as number] },
      properties: {
        id: `school-${s.semel}`,
        type: "school" as never,
        name_he: s.name_he,
        photo_url: null,
        photo_title: null,
        photo_page_url: null,
        photo_license: null,
        photo_artist: null,
        has_shade: null,
        modern_equipment: null,
      },
    }));

  // Real bus stops (Open Bus Stride) as type="transit" POIs, so the "תחבורה"
  // layer shows real dots instead of just the 2 train stations.
  const transitPois = loadTransitStops(input.city).map((s) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
    properties: {
      id: `busstop-${s.code}`,
      type: "transit" as never,
      name_he: s.name,
      photo_url: null,
      photo_title: null,
      photo_page_url: null,
      photo_license: null,
      photo_artist: null,
      has_shade: null,
      modern_equipment: null,
    },
  }));

  return {
    neighborhoods,
    pois: [...pois, ...schoolPois, ...transitPois],
    listingsByNeighborhood,
    schoolsByNeighborhood,
    electionsByNeighborhood,
  };
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestPOIMeters(
  from: [number, number],
  pois: POIDB[],
  type: string,
): number | null {
  let best: number | null = null;
  for (const p of pois) {
    if (p.type !== type || !p.point) continue;
    const d = haversineMeters(from, p.point.coordinates as [number, number]);
    if (best == null || d < best) best = d;
  }
  return best;
}

function poisWithinMeters(
  from: [number, number],
  pois: POIDB[],
  type: string,
  meters: number,
): number {
  let count = 0;
  for (const p of pois) {
    if (p.type !== type || !p.point) continue;
    if (haversineMeters(from, p.point.coordinates as [number, number]) <= meters) count++;
  }
  return count;
}

function nearestSchoolMeters(from: [number, number], schools: StaticSchool[]): number | null {
  let best: number | null = null;
  for (const s of schools) {
    if (s.lon == null || s.lat == null) continue;
    const d = haversineMeters(from, [s.lon, s.lat]);
    if (best == null || d < best) best = d;
  }
  return best;
}

function gardenShare(listings: { garden_sqm: number | null }[]): number {
  if (listings.length === 0) return 0.3;
  const withGarden = listings.filter((l) => l.garden_sqm != null && l.garden_sqm > 0).length;
  return withGarden / listings.length;
}

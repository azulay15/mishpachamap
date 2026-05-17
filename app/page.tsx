import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase";
import { ConciergeScreen, type ConciergeData } from "@/components/ConciergeScreen";
import { MOCK_DATA } from "@/lib/mockData";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { PERSONA_DEFAULT } from "@/lib/persona";
import { loadNeighborhoodFeatures, centroidOf } from "@/lib/geoData";

export const revalidate = 60;

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

type SchoolDB = {
  id: string;
  name_he: string;
  meitzav_score: number | null;
  level: string | null;
  orientation: string | null;
  bagrut_pass_rate: number | null;
  student_count: number | null;
  website_url: string | null;
  point: GeoJSON.Point;
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

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  );
}

export default async function Page() {
  // No env → preview mode against handoff mock data with the SVG stub map.
  if (!envConfigured()) {
    return <ConciergeScreen data={MOCK_DATA} renderer="stub" />;
  }

  const cookieStore = await cookies();
  const sb = serverSupabase(cookieStore);

  const [
    { data: nb },
    { data: metrics },
    { data: pois },
    { data: listings },
    { data: schools },
    { data: elections },
    { data: parties },
    { data: electionResults },
  ] = await Promise.all([
    sb.from("neighborhoods").select("id, name_he, family_label, summary_he, aliases"),
    sb.from("neighborhood_metrics").select("*"),
    sb.from("pois_geojson").select("id, type, name_he, point, meta"),
    sb.from("listings").select("id, neighborhood, address, price_nis, price_per_m2, rooms, sqm, garden_sqm, status_he, days_on_market"),
    sb.from("schools_geojson").select("id, name_he, meitzav_score, level, orientation, bagrut_pass_rate, student_count, website_url, point"),
    sb.from("elections").select("id, name_he, date").order("date", { ascending: false }),
    sb.from("parties").select("id, name_he, color"),
    sb.from("neighborhood_election_results").select("neighborhood, election, party, votes, pct"),
  ]);

  // Empty database → still preview mode (chrome only).
  if (!nb || nb.length === 0) {
    return <ConciergeScreen data={MOCK_DATA} renderer="stub" />;
  }

  const data = assemble({
    nb: nb as NeighborhoodRow[],
    metrics: (metrics ?? []) as MetricsRow[],
    pois: (pois ?? []) as POIDB[],
    listings: (listings ?? []) as ListingDB[],
    schools: (schools ?? []) as SchoolDB[],
    elections: (elections ?? []) as ElectionRow[],
    parties: (parties ?? []) as PartyRow[],
    electionResults: (electionResults ?? []) as ResultRow[],
  });

  return <ConciergeScreen data={data} renderer="mapbox" />;
}

function assemble(input: {
  nb: NeighborhoodRow[];
  metrics: MetricsRow[];
  pois: POIDB[];
  listings: ListingDB[];
  schools: SchoolDB[];
  elections: ElectionRow[];
  parties: PartyRow[];
  electionResults: ResultRow[];
}): ConciergeData {
  const metricsByNb = new Map(input.metrics.map((m) => [m.neighborhood, m]));
  const persona = PERSONA_DEFAULT;

  // Step 1 — build base neighborhood records (no matchScore yet).
  // Geometry is joined from the static `public/neighborhoods.geo.json` file.
  const geoFeatures = loadNeighborhoodFeatures();
  const featureById = new Map(geoFeatures.features.map((f) => [f.properties.id, f]));
  const base = input.nb
    .map((n) => {
      const feature = featureById.get(n.id);
      if (!feature) return null;
      const center = centroidOf(feature);
      const m = metricsByNb.get(n.id);
      return {
        id: n.id,
        he: n.name_he,
        family: n.family_label,
        summary: n.summary_he,
        polygon: feature.geometry,
        center,
        aliases: n.aliases ?? [],
        avgPrice: m?.avg_price_per_m2 ?? 0,
        avgPriceDelta: Number(m?.avg_price_yoy_pct ?? 0),
        avgListing: Number(m?.avg_listing_price ?? 0),
        greenScore: m?.green_score ?? 0,
        schoolScore: m?.school_score ?? 0,
        quietScore: m?.quiet_score ?? 70,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

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
  const WALK_M = 1000;
  const schoolsByNeighborhood: Record<string, ConciergeData["schoolsByNeighborhood"][string]> = {};
  for (const n of base) {
    const nearby: ConciergeData["schoolsByNeighborhood"][string] = [];
    for (const s of input.schools) {
      if (!s.point) continue;
      const d = haversineMeters(n.center, s.point.coordinates as [number, number]);
      if (d > WALK_M) continue;
      nearby.push({
        id: s.id,
        name_he: s.name_he,
        meitzav_score: s.meitzav_score == null ? null : Number(s.meitzav_score),
        walkMinutes: Math.max(1, Math.round(d / 80)),
        level: s.level,
        orientation: s.orientation,
        bagrutPassRate: s.bagrut_pass_rate == null ? null : Number(s.bagrut_pass_rate),
        studentCount: s.student_count,
        websiteUrl: s.website_url,
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
      schoolWalkMeters: nearestSchoolMeters(n.center, input.schools),
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

  return { neighborhoods, pois, listingsByNeighborhood, schoolsByNeighborhood, electionsByNeighborhood };
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

function nearestSchoolMeters(from: [number, number], schools: SchoolDB[]): number | null {
  let best: number | null = null;
  for (const s of schools) {
    if (!s.point) continue;
    const d = haversineMeters(from, s.point.coordinates as [number, number]);
    if (best == null || d < best) best = d;
  }
  return best;
}

function gardenShare(listings: { garden_sqm: number | null }[]): number {
  if (listings.length === 0) return 0.3;
  const withGarden = listings.filter((l) => l.garden_sqm != null && l.garden_sqm > 0).length;
  return withGarden / listings.length;
}

function nearestNeighborhood(
  pt: [number, number],
  neighborhoods: { id: string; center: GeoJSON.Position }[],
): { id: string } | null {
  let best: { id: string; d: number } | null = null;
  for (const n of neighborhoods) {
    const dx = (n.center[0] as number) - pt[0];
    const dy = (n.center[1] as number) - pt[1];
    const d = dx * dx + dy * dy;
    if (!best || d < best.d) best = { id: n.id, d };
  }
  return best;
}

/**
 * Refine neighborhood polygons against OSM data, scoped strictly inside the
 * Modi'in-Maccabim-Reut admin boundary (wikidata Q175467) via Overpass.
 *
 * Validation per candidate polygon:
 *   - all vertices inside Modi'in bbox (+500m buffer)
 *   - area between 0.05 km² (5 ha) and 5 km²
 *   - at least 8 vertices (rejects placeholder bboxes)
 *   - name matches one of our 7 targets (fuzzy: substring either way)
 *
 * Anything that fails validation is logged and left alone — the existing
 * hand-aligned rectangle from `seed_neighborhoods` stays in place.
 *
 * Re-runnable. To revert all 7 to rectangles, run `npm run ingest:seed` first.
 */
import { sb, wktPolygon, MODIIN_BBOX, fetchOverpass } from "./_env";

type Target = { id: string; names: string[] };

const TARGETS: Target[] = [
  { id: "buchman",   names: ["בוכמן", "Buchman"] },
  { id: "hakramim",  names: ["הכרמים", "כרמים", "HaKramim", "Kramim"] },
  { id: "nofim",     names: ["נופים", "Nofim"] },
  { id: "kaiser",    names: ["קייזר", "Kaiser"] },
  { id: "shimshoni", names: ["שמשוני", "Shimshoni"] },
  { id: "moriah",    names: ["מוריה", "Moriah"] },
  { id: "merkaz",    names: ["מרכז העיר", "מרכז", "City Center"] },
];

const QUERY = `
[out:json][timeout:60];
// Modi'in-Maccabim-Reut admin area
area["wikidata"="Q175467"]->.modiin;
(
  // Place-tagged ways/relations (suburb / neighbourhood / quarter)
  way[place~"^(suburb|neighbourhood|quarter)$"][name](area.modiin);
  relation[place~"^(suburb|neighbourhood|quarter)$"][name](area.modiin);
  // Sub-municipal admin boundaries
  relation[boundary=administrative][admin_level~"^(10|11)$"](area.modiin);
  // Named residential land-use polygons (often the neighborhood shape in IL)
  way[landuse=residential][name](area.modiin);
  relation[landuse=residential][name](area.modiin);
);
out body geom;
>;
out skel qt;
`;

type OverpassWay = {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};
type OverpassRelation = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role?: string;
    geometry?: { lat: number; lon: number }[];
  }>;
};
type OverpassNode = { type: "node"; id: number; lat: number; lon: number };
type OverpassElement = OverpassWay | OverpassRelation | OverpassNode;

const BBOX_BUFFER = 0.005; // ~500m
const MIN_POINTS = 8;
const MIN_AREA_KM2 = 0.05;
const MAX_AREA_KM2 = 5.0;

function nameOf(el: { tags?: Record<string, string> }): string | null {
  return el.tags?.["name:he"] ?? el.tags?.name ?? null;
}

function findTarget(name: string): Target | null {
  for (const t of TARGETS) {
    for (const candidate of t.names) {
      if (name.includes(candidate) || candidate.includes(name)) return t;
    }
  }
  return null;
}

function allInsideBbox(ring: [number, number][]): boolean {
  return ring.every(
    ([lng, lat]) =>
      lat >= MODIIN_BBOX.south - BBOX_BUFFER &&
      lat <= MODIIN_BBOX.north + BBOX_BUFFER &&
      lng >= MODIIN_BBOX.west - BBOX_BUFFER &&
      lng <= MODIIN_BBOX.east + BBOX_BUFFER,
  );
}

/** Shoelace area in degrees² → rough km² conversion at Modi'in latitude (~31.9°). */
function approxAreaKm2(ring: [number, number][]): number {
  // Shoelace in lat/lng — convert each delta to meters using a local scale.
  // At lat 31.9°, 1° lat ≈ 111 km; 1° lng ≈ 111 * cos(31.9°) ≈ 94.2 km.
  const latKm = 111;
  const lngKm = 94.2;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 * lngKm) * (y1 * latKm) - (x1 * lngKm) * (y2 * latKm);
  }
  return Math.abs(sum / 2);
}

function ensureClosed(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) return ring;
  return [...ring, [fx, fy]];
}

function ringFromWayGeometry(way: OverpassWay): [number, number][] | null {
  if (!way.geometry || way.geometry.length < 3) return null;
  return way.geometry.map((g) => [g.lon, g.lat] as [number, number]);
}

/**
 * Assemble outer ring from a relation's `outer` members. Naïve — concatenates
 * way geometries without proper end-to-end stitching, which fails for some
 * multipolygons but works for simple boundary relations where outer ways are
 * already in order.
 */
function ringFromRelation(rel: OverpassRelation): [number, number][] | null {
  if (!rel.members) return null;
  const outer = rel.members.filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""));
  if (outer.length === 0) return null;
  const coords: [number, number][] = [];
  for (const m of outer) {
    if (!m.geometry) continue;
    for (const g of m.geometry) coords.push([g.lon, g.lat]);
  }
  return coords.length >= 3 ? coords : null;
}

type Candidate = {
  target: Target;
  name: string;
  ring: [number, number][];
  source: string;
  points: number;
  areaKm2: number;
};

async function main() {
  console.log("→ querying Overpass (scoped to Modi'in admin area)…");
  const json = await fetchOverpass<{ elements: OverpassElement[] }>(QUERY);
  console.log(`  got ${json.elements.length} raw elements`);

  // Collect candidates per target — best polygon wins.
  const byTarget: Map<string, Candidate> = new Map();

  for (const el of json.elements) {
    if (el.type === "node") continue;
    const name = nameOf(el);
    if (!name) continue;
    const target = findTarget(name);
    if (!target) continue;

    let ring = el.type === "way" ? ringFromWayGeometry(el) : ringFromRelation(el);
    if (!ring) continue;

    ring = ensureClosed(ring);
    const points = ring.length - 1;
    const insideOK = allInsideBbox(ring);
    const areaKm2 = approxAreaKm2(ring);

    const passes =
      points >= MIN_POINTS &&
      insideOK &&
      areaKm2 >= MIN_AREA_KM2 &&
      areaKm2 <= MAX_AREA_KM2;

    const tag = el.type === "way" ? "way" : "rel";
    console.log(
      `  ${passes ? "✓" : "·"} ${target.id} ← ${tag}/${el.id} "${name}" — ${points}pt, ` +
        `area ${areaKm2.toFixed(2)}km², ${insideOK ? "in-bbox" : "OUT OF BBOX"}`,
    );
    if (!passes) continue;

    // Prefer candidates with more points (closer to real shape).
    const prev = byTarget.get(target.id);
    if (!prev || points > prev.points) {
      byTarget.set(target.id, {
        target,
        name,
        ring,
        source: `${tag}/${el.id}`,
        points,
        areaKm2,
      });
    }
  }

  console.log(`\n→ applying ${byTarget.size} updates…`);
  let updated = 0;
  for (const c of byTarget.values()) {
    const { error } = await sb
      .from("neighborhoods")
      .update({ polygon: wktPolygon(c.ring) })
      .eq("id", c.target.id);
    if (error) {
      console.error(`✗ ${c.target.id}: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`✓ ${c.target.id} ← ${c.source} (${c.name}, ${c.points}pt, ${c.areaKm2.toFixed(2)}km²)`);
      updated++;
    }
  }

  const skipped = TARGETS.length - updated;
  console.log(`\nDone. ${updated} updated from OSM, ${skipped} kept as hand-aligned.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

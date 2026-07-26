/**
 * Build neighborhood polygons for a city from authoritative open data — no
 * hand-drawing required.
 *
 * Pipeline (per city, see `cities.ts`):
 *   1. Pull CBS 2022 statistical-area polygons for the locality (ArcGIS, WGS84).
 *   2. Pull OSM building footprints for the locality's bbox → a "built-up mask"
 *      (concave hull of buildings, buffered to include yards + streets).
 *   3. Assign each statistical area to its nearest neighborhood anchor
 *      (Voronoi), applying any per-city `statOverrides`.
 *   4. Dissolve the areas of each neighborhood into one polygon, then clip to
 *      the built-up mask so boundaries hug the residential blocks instead of
 *      sprawling into open land. Neighbours still meet on the CBS lines.
 *   5. Write a FeatureCollection to the city's `outFile`.
 *
 * Usage:
 *   npm run polygons:build              # default city (modiin)
 *   npm run polygons:build -- --city X  # some other city id from cities.ts
 *
 * After building:  npm run polygons:validate  &&  npm run ingest:seed
 *
 * This script only reads open data + writes a GeoJSON file — it needs no
 * Supabase credentials (unlike the seed step).
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { CITIES, type CityConfig, type NeighborhoodAnchor } from "./cities";

/** National CBS 2022 statistical-areas layer (IsraelData on ArcGIS Hub). */
const CBS_QUERY =
  "https://services8.arcgis.com/JcXY3lLZni6BK4El/arcgis/rest/services/statistical_areas_2022/FeatureServer/0/query";

const UA = "MishpachaMap/0.1 (neighborhood polygon builder)";

type CbsProps = { STAT_2022: number; SEMEL_YISHUV: number; SHEM_YISHUV: string };
type CbsFeature = Feature<Polygon | MultiPolygon, CbsProps>;

/** Fetch every statistical area for one locality, reprojected to WGS84. */
async function fetchCbsAreas(semelYishuv: number): Promise<CbsFeature[]> {
  const params = new URLSearchParams({
    where: `SEMEL_YISHUV=${semelYishuv}`,
    outFields: "STAT_2022,SEMEL_YISHUV,SHEM_YISHUV",
    outSR: "4326",
    f: "geojson",
  });
  const res = await fetch(`${CBS_QUERY}?${params.toString()}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CBS ArcGIS: ${res.status} ${res.statusText}`);
  const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon, CbsProps>;
  if (!fc.features?.length) {
    throw new Error(`CBS returned no statistical areas for semel ${semelYishuv}`);
  }
  return fc.features;
}

/** POST an Overpass query, with the User-Agent + retry Overpass expects. */
async function fetchOverpass<T>(query: string): Promise<T> {
  const body = "data=" + encodeURIComponent(query);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body,
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status === 504) {
      const wait = attempt * 5000;
      console.warn(`  Overpass ${res.status}; retrying in ${wait / 1000}s (${attempt}/3)…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Overpass: ${res.status} ${res.statusText}`);
  }
  throw new Error("Overpass: exhausted retries");
}

/** Building-footprint centers inside a bbox [w,s,e,n]. */
async function fetchBuildingPoints(bbox: [number, number, number, number]): Promise<Feature[]> {
  const [w, s, e, n] = bbox;
  const q =
    `[out:json][timeout:90];` +
    `(way["building"](${s},${w},${n},${e});relation["building"](${s},${w},${n},${e}););` +
    `out center;`;
  const json = await fetchOverpass<{ elements: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number } }> }>(q);
  return json.elements
    .map((el) => el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null))
    .filter((c): c is { lat: number; lon: number } => !!c)
    .map((c) => turf.point([c.lon, c.lat]));
}

/** Concave hull of the buildings, buffered — the residential footprint. */
function buildBuiltUpMask(
  points: Feature[],
  concaveMaxEdgeKm: number,
  bufferMeters: number,
): Feature<Polygon | MultiPolygon> {
  const fc = turf.featureCollection(points as Feature<import("geojson").Point>[]);
  const hull = turf.concave(fc, { units: "kilometers", maxEdge: concaveMaxEdgeKm }) ?? turf.convex(fc);
  if (!hull) throw new Error("could not build a hull from building points");
  const buffered = turf.buffer(hull, bufferMeters, { units: "meters" })!;
  return turf.simplify(buffered, { tolerance: 0.00008, highQuality: true });
}

function nearestAnchor(centroid: [number, number], anchors: NeighborhoodAnchor[]): string {
  let best = anchors[0].id;
  let bestKm = Infinity;
  const pt = turf.point(centroid);
  for (const a of anchors) {
    const d = turf.distance(pt, turf.point([a.lng, a.lat]), { units: "kilometers" });
    if (d < bestKm) {
      bestKm = d;
      best = a.id;
    }
  }
  return best;
}

/** Round every coordinate to 6 dp (~0.1m) and guarantee a closed ring. */
function tidyPolygon(feature: Feature<Polygon>): Feature<Polygon> {
  const rings = feature.geometry.coordinates.map((ring) => {
    const r = ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    const [fx, fy] = r[0];
    const [lx, ly] = r[r.length - 1];
    if (fx !== lx || fy !== ly) r.push([fx, fy]);
    return r;
  });
  return { ...feature, geometry: { type: "Polygon", coordinates: rings } };
}

/** Keep only the largest ring of a possibly-multipart clip result. */
function largestPolygon(f: Feature<Polygon | MultiPolygon>): Feature<Polygon> {
  if (f.geometry.type === "Polygon") return f as Feature<Polygon>;
  let best: Feature<Polygon> | null = null;
  let bestArea = 0;
  for (const coords of f.geometry.coordinates) {
    const poly = turf.polygon(coords);
    const a = turf.area(poly);
    if (a > bestArea) {
      bestArea = a;
      best = poly as Feature<Polygon>;
    }
  }
  if (!best) throw new Error("multipolygon had no parts");
  return best;
}

async function build(city: CityConfig) {
  const clipBuffer = city.clipBufferMeters ?? 35;
  const maxEdge = city.concaveMaxEdgeKm ?? 0.18;

  console.log(`→ ${city.id}: fetching CBS 2022 statistical areas (semel ${city.semelYishuv})…`);
  const cbs = await fetchCbsAreas(city.semelYishuv);
  console.log(`  ${cbs.length} statistical areas`);

  const bbox = turf.bbox(turf.featureCollection(cbs)) as [number, number, number, number];
  console.log(`→ fetching OSM buildings in bbox…`);
  const buildings = await fetchBuildingPoints(bbox);
  console.log(`  ${buildings.length} building footprints`);

  console.log(`→ building built-up mask (concave hull + ${clipBuffer}m buffer)…`);
  const mask = buildBuiltUpMask(buildings, maxEdge, clipBuffer);

  // Assign each statistical area to a neighborhood.
  const overrides = city.statOverrides ?? {};
  const groups = new Map<string, CbsFeature[]>();
  const assigned: Array<{ stat: number; nid: string; overridden: boolean }> = [];
  for (const area of cbs) {
    const stat = area.properties.STAT_2022;
    const centroid = turf.centroid(area).geometry.coordinates as [number, number];
    const nid = overrides[stat] ?? nearestAnchor(centroid, city.anchors);
    (groups.get(nid) ?? groups.set(nid, []).get(nid)!).push(area);
    assigned.push({ stat, nid, overridden: stat in overrides });
  }

  // Dissolve + clip per neighborhood, preserving anchor order.
  const features: Feature<Polygon>[] = [];
  // Unclipped stat-area unions — the TRUE neighborhood extents (incl. street
  // gaps). Used for point-in-polygon assignment (e.g. prices.ts) where the
  // display-clipped shapes are too tight and drop legit parcels.
  const rawFeatures: Feature<Polygon>[] = [];
  for (const anchor of city.anchors) {
    const areas = groups.get(anchor.id) ?? [];
    if (areas.length === 0) {
      console.warn(`  ⚠ ${anchor.id}: no statistical areas assigned — skipped`);
      continue;
    }
    // Union the assigned areas.
    let union: Feature<Polygon | MultiPolygon> = turf.feature(areas[0].geometry) as Feature<Polygon | MultiPolygon>;
    for (let i = 1; i < areas.length; i++) {
      const u = turf.union(turf.featureCollection([union, turf.feature(areas[i].geometry)]) as never);
      if (u) union = u;
    }
    // Clip to the built-up mask; fall back to the raw union if the clip is empty.
    let clipped: Feature<Polygon | MultiPolygon> = union;
    const inter = turf.intersect(turf.featureCollection([union, mask]) as never);
    if (inter) clipped = inter;

    const poly = tidyPolygon(
      turf.simplify(largestPolygon(clipped), { tolerance: 0.00004, highQuality: true }) as Feature<Polygon>,
    );
    poly.properties = {
      id: anchor.id,
      name_he: anchor.name_he,
      name_en: anchor.name_en,
      stat_areas: areas.map((a) => a.properties.STAT_2022).sort((a, b) => a - b),
      center_source: "cbs_2022_clipped",
    };
    features.push(poly);

    // Unclipped union (true extent) — same properties, no built-up clip.
    const rawPoly = tidyPolygon(largestPolygon(union));
    rawPoly.properties = { id: anchor.id, name_he: anchor.name_he, name_en: anchor.name_en };
    rawFeatures.push(rawPoly);
    const nStat = areas.length;
    const nVerts = poly.geometry.coordinates[0].length;
    console.log(`  ✓ ${anchor.id.padEnd(12)} ${nStat} area(s) → ${nVerts} verts`);
  }

  const fc = {
    type: "FeatureCollection" as const,
    name: `neighborhoods_${city.id}`,
    meta: {
      generated_by: "scripts/ingest/build_neighborhoods.ts",
      source: "CBS statistical areas 2022 (ArcGIS/IsraelData), clipped to OSM building footprint",
      city: city.id,
      semel_yishuv: city.semelYishuv,
      generated_at: new Date().toISOString(),
    },
    features,
  };

  const out = resolve(process.cwd(), city.outFile);
  writeFileSync(out, JSON.stringify(fc, null, 2) + "\n", "utf8");
  console.log(`\n→ wrote ${features.length} neighborhoods to ${city.outFile}`);

  // Sidecar: unclipped unions for point assignment (prices, future POIs).
  const rawOutFile = city.outFile.replace(/\.geo\.json$/, ".raw.geo.json");
  writeFileSync(
    resolve(process.cwd(), rawOutFile),
    JSON.stringify({ type: "FeatureCollection", features: rawFeatures }, null, 2) + "\n",
    "utf8",
  );
  console.log(`→ wrote ${rawFeatures.length} unclipped unions to ${rawOutFile}`);

  // Override audit, so the maintainer can sanity-check the manual fixes.
  const ov = assigned.filter((a) => a.overridden);
  if (ov.length) {
    console.log(`  overrides applied: ${ov.map((a) => `${a.stat}→${a.nid}`).join(", ")}`);
  }
  console.log(`\nNext:  npm run polygons:validate   then   npm run ingest:seed`);
}

async function main() {
  const cityArg = (() => {
    const i = process.argv.indexOf("--city");
    return i >= 0 ? process.argv[i + 1] : "modiin";
  })();
  const city = CITIES[cityArg];
  if (!city) {
    console.error(`Unknown city "${cityArg}". Known: ${Object.keys(CITIES).join(", ")}`);
    process.exit(1);
  }
  await build(city);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

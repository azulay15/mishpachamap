/**
 * NYC POC — GreenScore + quiet per neighborhood from OpenStreetMap, the same
 * method the Israeli cities use (OSM is global, so this ports directly):
 *   green_score — share of the neighborhood covered by green land use
 *   quiet_score — distance from the centroid to a major noise source
 *                 (motorway/trunk/primary road, rail, industrial)
 *
 * Usage:  npx tsx scripts/ingest/nyc_environment.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, Polygon, LineString } from "geojson";

const UA = "MishpachaMap/0.1 (nyc environment)";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
async function overpass<T>(query: string): Promise<T> {
  const body = "data=" + encodeURIComponent(query);
  for (const ep of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": UA }, body });
        if (res.ok) {
          const t = await res.text();
          if (!t.startsWith("<")) return JSON.parse(t) as T;
        }
        await new Promise((r) => setTimeout(r, attempt * 4000));
      } catch { await new Promise((r) => setTimeout(r, attempt * 4000)); }
    }
    console.warn(`  (endpoint failed, trying next)`);
  }
  throw new Error("Overpass: all endpoints failed");
}

type OsmEl = { type: string; geometry?: { lat: number; lon: number }[] };
function toPolygons(els: OsmEl[]): Feature<Polygon>[] {
  const out: Feature<Polygon>[] = [];
  for (const el of els) {
    const g = el.geometry;
    if (!g || g.length < 4) continue;
    const ring = g.map((p) => [p.lon, p.lat] as [number, number]);
    const [fx, fy] = ring[0], [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]);
    if (ring.length < 4) continue;
    try { out.push(turf.polygon([ring])); } catch { /* skip degenerate */ }
  }
  return out;
}
function toLines(els: OsmEl[]): Feature<LineString>[] {
  const out: Feature<LineString>[] = [];
  for (const el of els) {
    const g = el.geometry;
    if (!g || g.length < 2) continue;
    out.push(turf.lineString(g.map((p) => [p.lon, p.lat] as [number, number])));
  }
  return out;
}

async function main() {
  const geoPath = resolve(process.cwd(), "public", "neighborhoods.nyc.geo.json");
  if (!existsSync(geoPath)) throw new Error("run nyc_geo.ts first");
  const geo = JSON.parse(readFileSync(geoPath, "utf8")) as { features: Array<Feature<Polygon, { id: string; name_he: string }>> };
  const [w, s, e, n] = turf.bbox(turf.featureCollection(geo.features as never));
  const bbox = `${s},${w},${n},${e}`;

  console.log("→ fetching OSM green + noise sources for the POC area…");
  const greenRes = await overpass<{ elements: OsmEl[] }>(
    `[out:json][timeout:120];(way["leisure"~"park|garden|nature_reserve|playground"](${bbox});way["landuse"~"grass|forest|recreation_ground|village_green|meadow|cemetery"](${bbox});way["natural"~"wood|scrub|grassland"](${bbox}););out geom;`,
  );
  const noiseRes = await overpass<{ elements: OsmEl[] }>(
    `[out:json][timeout:120];(way["highway"~"motorway|trunk|primary"](${bbox});way["railway"="rail"](${bbox});way["landuse"="industrial"](${bbox}););out geom;`,
  );
  const green = toPolygons(greenRes.elements);
  const noise = toLines(noiseRes.elements.filter((el) => el.type === "way"));
  console.log(`  ${green.length} green areas, ${noise.length} noise-source lines`);

  const out: Record<string, { green_score: number; quiet_score: number | null }> = {};
  const rows: Array<{ id: string; name: string; share: number; green: number; quiet: number | null }> = [];
  for (const f of geo.features) {
    const nb = turf.feature(f.geometry) as Feature<Polygon>;
    const nbArea = turf.area(nb);
    let greenArea = 0;
    for (const gp of green) {
      let inter: any = null;
      try { inter = turf.intersect(turf.featureCollection([nb, gp]) as never); } catch { inter = null; }
      if (inter) greenArea += turf.area(inter);
    }
    const share = nbArea > 0 ? greenArea / nbArea : 0;
    const centroid = turf.centroid(nb);
    let nearestKm = Infinity;
    for (const line of noise) {
      const d = turf.pointToLineDistance(centroid, line, { units: "kilometers" });
      if (d < nearestKm) nearestKm = d;
    }
    const nearestM = nearestKm === Infinity ? null : nearestKm * 1000;
    // Same mapping as the Israeli cities (comparable scores across countries).
    const green_score = Math.round(Math.min(100, Math.max(0, share * 400)));
    const quiet_score = nearestM == null ? null : Math.round(Math.min(98, Math.max(30, 30 + (nearestM / 1400) * 68)));
    out[f.properties.id] = { green_score, quiet_score };
    rows.push({ id: f.properties.id, name: f.properties.name_he, share, green: green_score, quiet: quiet_score });
  }

  writeFileSync(
    resolve(process.cwd(), "public", "nyc.environment.json"),
    JSON.stringify({ meta: { source: "OpenStreetMap green land-use + noise sources (Overpass)", city: "nyc" }, neighborhoods: out }, null, 2) + "\n",
    "utf8",
  );
  console.log("\nneighborhood                                green%  GreenScore  quiet");
  for (const r of rows.sort((a, b) => b.green - a.green)) {
    console.log(`  ${r.name.slice(0, 40).padEnd(41)} ${(r.share * 100).toFixed(1).padStart(5)}   ${String(r.green).padStart(3)}       ${r.quiet ?? "?"}`);
  }
  console.log(`\n✓ wrote public/nyc.environment.json — ${rows.length} neighborhoods`);
}

main().catch((e) => { console.error(e); process.exit(1); });

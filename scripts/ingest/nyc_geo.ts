/**
 * NYC POC — neighborhood polygons from NYC Open Data 2020 NTAs (dataset
 * 9nt8-h7nd), residential only (ntatype='0'), Manhattan for the POC. Transforms
 * each NTA (a MultiPolygon) to the app's geo format (largest Polygon part,
 * simplified). No API key needed.
 *
 * Usage:  npx tsx scripts/ingest/nyc_geo.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";

const NTA_URL =
  "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?" +
  new URLSearchParams({ $where: "boroname='Manhattan' and ntatype='0'", $limit: "300" }).toString();

/* eslint-disable @typescript-eslint/no-explicit-any */
function largestPolygon(geom: Polygon | MultiPolygon): Feature<Polygon> {
  if (geom.type === "Polygon") return turf.polygon(geom.coordinates);
  let best: Feature<Polygon> | null = null;
  let bestArea = 0;
  for (const coords of geom.coordinates) {
    const poly = turf.polygon(coords);
    const a = turf.area(poly);
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  if (!best) throw new Error("empty MultiPolygon");
  return best;
}

function tidy(f: Feature<Polygon>): Polygon {
  const s = turf.simplify(f, { tolerance: 0.00006, highQuality: true }) as Feature<Polygon>;
  const rings = s.geometry.coordinates.map((ring) => {
    const r = ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    const [fx, fy] = r[0];
    const [lx, ly] = r[r.length - 1];
    if (fx !== lx || fy !== ly) r.push([fx, fy]);
    return r;
  });
  return { type: "Polygon", coordinates: rings };
}

async function main() {
  console.log("→ fetching Manhattan NTA 2020 polygons (NYC Open Data 9nt8-h7nd)…");
  const res = await fetch(NTA_URL, { headers: { Accept: "application/json", "User-Agent": "MishpachaMap/0.1" } });
  if (!res.ok) throw new Error(`NTA: ${res.status} ${res.statusText}`);
  const fc = (await res.json()) as { features: any[] };
  console.log(`  ${fc.features.length} residential NTAs`);

  const features = fc.features
    .filter((f) => f.geometry && f.properties?.nta2020)
    .map((f) => {
      const p = f.properties;
      const geometry = tidy(largestPolygon(f.geometry));
      return {
        type: "Feature" as const,
        geometry,
        properties: {
          id: String(p.nta2020).toLowerCase(), // e.g. "mn0201"
          name_he: p.ntaname, // POC: display name (English) lives here — the app renders name_he
          name_en: p.ntaname,
          borough: p.boroname,
          nta: p.nta2020,
          verts: geometry.coordinates[0].length,
        },
      };
    })
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

  const out = resolve(process.cwd(), "public", "neighborhoods.nyc.geo.json");
  writeFileSync(out, JSON.stringify({ type: "FeatureCollection", name: "neighborhoods_nyc", meta: { source: "NYC Open Data 2020 NTAs 9nt8-h7nd (residential, Manhattan)" }, features }, null, 2) + "\n", "utf8");
  console.log(`✓ wrote ${features.length} neighborhoods → public/neighborhoods.nyc.geo.json`);
  for (const f of features) console.log(`  ${f.properties.id}  ${f.properties.name_he}  (${f.properties.verts} verts)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

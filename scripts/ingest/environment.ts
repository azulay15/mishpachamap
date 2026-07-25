/**
 * Real GreenScore + quiet per neighborhood, from OpenStreetMap — replacing the
 * hardcoded 75 / 70 constants in `neighborhood_metrics`.
 *
 *   green_score  — share of each neighborhood polygon covered by green land
 *                  (parks/gardens/grass/forest/scrub), 0–100.
 *   quiet_score  — how far the neighborhood centroid sits from a major noise
 *                  source (motorway/trunk/primary road, rail, industrial),
 *                  0–100 (farther = quieter). Modi'in's sources are Route 443,
 *                  Route 6, and the rail line.
 *
 * Both are REAL and per-neighborhood (the old constants were identical for all
 * 14). Writes directly to the DB via an UPDATE (no migration). `compute_metrics`
 * no longer sets these two, so a metrics recompute won't clobber them.
 *
 * Usage:  npm run ingest:environment
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, Polygon, LineString } from "geojson";
import { sb } from "./_env";

const UA = "MishpachaMap/0.1 (environment ingest)";

async function overpass<T>(query: string): Promise<T> {
  const body = "data=" + encodeURIComponent(query);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": UA },
      body,
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status === 504) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    throw new Error(`Overpass ${res.status}`);
  }
  throw new Error("Overpass: exhausted retries");
}

type OsmEl = { type: string; geometry?: { lat: number; lon: number }[] };

/** Closed OSM ways → turf polygons. */
function toPolygons(elements: OsmEl[]): Feature<Polygon>[] {
  const out: Feature<Polygon>[] = [];
  for (const el of elements) {
    const g = el.geometry;
    if (!g || g.length < 4) continue;
    const ring = g.map((p) => [p.lon, p.lat] as [number, number]);
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]); // close
    if (ring.length < 4) continue;
    try {
      out.push(turf.polygon([ring]));
    } catch {
      /* skip degenerate */
    }
  }
  return out;
}

/** OSM ways → turf linestrings. */
function toLines(elements: OsmEl[]): Feature<LineString>[] {
  const out: Feature<LineString>[] = [];
  for (const el of elements) {
    const g = el.geometry;
    if (!g || g.length < 2) continue;
    out.push(turf.lineString(g.map((p) => [p.lon, p.lat] as [number, number])));
  }
  return out;
}

async function main() {
  const geo = JSON.parse(readFileSync(resolve(process.cwd(), "public", "neighborhoods.geo.json"), "utf8")) as {
    features: Array<Feature<Polygon, { id: string; name_he: string }>>;
  };
  const [w, s, e, n] = turf.bbox(turf.featureCollection(geo.features as never));
  const bbox = `${s},${w},${n},${e}`;

  console.log("→ fetching OSM green + noise sources…");
  const greenRes = await overpass<{ elements: OsmEl[] }>(
    `[out:json][timeout:90];(way["leisure"~"park|garden|nature_reserve"](${bbox});way["landuse"~"grass|forest|recreation_ground|village_green|meadow|orchard"](${bbox});way["natural"~"wood|scrub|grassland"](${bbox}););out geom;`,
  );
  const noiseRes = await overpass<{ elements: OsmEl[] }>(
    `[out:json][timeout:90];(way["highway"~"motorway|trunk|primary"](${bbox});way["railway"="rail"](${bbox});way["landuse"="industrial"](${bbox}););out geom;`,
  );
  const green = toPolygons(greenRes.elements);
  const noiseLines = toLines(noiseRes.elements.filter((el) => el.type === "way"));
  console.log(`  ${green.length} green areas, ${noiseLines.length} noise-source lines`);

  // Per neighborhood: green share + distance to nearest noise source.
  const rows = geo.features.map((f) => {
    const nb = turf.feature(f.geometry) as Feature<Polygon>;
    const nbArea = turf.area(nb);

    let greenArea = 0;
    for (const gp of green) {
      let inter;
      try {
        inter = turf.intersect(turf.featureCollection([nb, gp]) as never);
      } catch {
        inter = null;
      }
      if (inter) greenArea += turf.area(inter);
    }
    const share = nbArea > 0 ? greenArea / nbArea : 0;

    const centroid = turf.centroid(nb);
    let nearestKm = Infinity;
    for (const line of noiseLines) {
      const d = turf.pointToLineDistance(centroid, line, { units: "kilometers" });
      if (d < nearestKm) nearestKm = d;
    }
    const nearestM = nearestKm === Infinity ? null : nearestKm * 1000;

    // Map to 0–100. Green: ~25% cover → 100 (green city; reward it). Quiet:
    // adjacent to a noise source → ~30, ≥1400m away → ~98 (Modi'in is generally
    // quiet, so the floor isn't 0, but spread the middle).
    const green_score = Math.round(Math.min(100, Math.max(0, share * 400)));
    const quiet_score = nearestM == null ? null : Math.round(Math.min(98, Math.max(30, 30 + (nearestM / 1400) * 68)));

    return { id: f.properties.id, name_he: f.properties.name_he, share, nearestM, green_score, quiet_score };
  });

  console.log("\nneighborhood     green%  GreenScore   nearestNoise  quiet");
  for (const r of rows.sort((a, b) => b.green_score - a.green_score)) {
    console.log(
      `  ${r.id.padEnd(13)} ${(r.share * 100).toFixed(1).padStart(5)}   ${String(r.green_score).padStart(3)}        ${r.nearestM == null ? "  ?" : Math.round(r.nearestM) + "m"}`.padEnd(58) + `${r.quiet_score ?? "?"}`,
    );
  }

  console.log("\n→ updating neighborhood_metrics (green_score + quiet_score)…");
  for (const r of rows) {
    const { error } = await sb
      .from("neighborhood_metrics")
      .update({ green_score: r.green_score, quiet_score: r.quiet_score })
      .eq("neighborhood", r.id);
    if (error) {
      console.error(`✗ ${r.id}: ${error.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`✓ updated ${rows.length} neighborhoods with real green + quiet scores`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

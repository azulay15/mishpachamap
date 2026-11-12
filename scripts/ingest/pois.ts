/**
 * Everyday places per city from OpenStreetMap, written as a STATIC file:
 * public/<city>.pois.json — parks, playgrounds, grocery shops, preschools and
 * community places (synagogues, community centres).
 *
 * Why: these map layers — and the "park nearby" / "grocery nearby" parts of the
 * match score — were fed only by the Supabase `pois` table, which holds
 * Modi'in. Every other city showed empty layers and scored those features as
 * "unknown". This gives each city the same coverage with no DB.
 *
 * Only places inside the city's neighborhoods (or within EDGE_KM of one) are
 * kept; the bbox query also returns the neighbouring towns.
 *
 * Usage:  npx tsx scripts/ingest/pois.ts --city haifa
 *         npx tsx scripts/ingest/pois.ts --all
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { CITIES, type CityConfig } from "./cities";

const UA = "neighborhood-data-ingest/0.1 (places)";
const EDGE_KM = 0.15;

type PoiType = "park" | "playground" | "shop" | "preschool" | "community";
type OsmEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function overpass<T>(query: string): Promise<T> {
  const body = "data=" + encodeURIComponent(query);
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  let lastErr = "";
  for (const ep of endpoints) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": UA },
          body,
        });
        if (res.ok) {
          const text = await res.text();
          if (!text.startsWith("<")) return JSON.parse(text) as T;
          lastErr = "HTML quota response";
        } else {
          lastErr = `${res.status}`;
        }
      } catch (e) {
        lastErr = String(e);
      }
      await new Promise((r) => setTimeout(r, attempt * 4000));
    }
    console.warn(`  (Overpass ${lastErr} — trying next mirror)`);
  }
  throw new Error(`Overpass: all mirrors failed (last: ${lastErr})`);
}

function classify(tags: Record<string, string>): PoiType | null {
  if (tags.leisure === "playground") return "playground";
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.shop === "supermarket" || tags.shop === "convenience" || tags.shop === "greengrocer") return "shop";
  if (tags.amenity === "kindergarten") return "preschool";
  if (tags.amenity === "place_of_worship" || tags.amenity === "community_centre") return "community";
  return null;
}

const DEFAULT_NAME: Record<PoiType, string> = {
  park: "גינה ציבורית",
  playground: "מתקני משחק",
  shop: "מכולת",
  preschool: "גן ילדים",
  community: "מרכז קהילתי",
};

async function buildCity(city: CityConfig): Promise<boolean> {
  const rawFile = city.outFile.replace(/\.geo\.json$/, ".raw.geo.json");
  const geoFile = existsSync(resolve(process.cwd(), rawFile)) ? rawFile : city.outFile;
  if (!existsSync(resolve(process.cwd(), geoFile))) {
    console.error(`✗ ${city.id}: no geo file — build polygons first.`);
    return false;
  }
  const fc = JSON.parse(readFileSync(resolve(process.cwd(), geoFile), "utf8")) as {
    features: Array<Feature<Polygon | MultiPolygon>>;
  };
  const [w, s, e, n] = turf.bbox(fc as never);
  const box = `${(s - 0.003).toFixed(4)},${(w - 0.003).toFixed(4)},${(n + 0.003).toFixed(4)},${(e + 0.003).toFixed(4)}`;
  console.log(`\n→ ${city.id}: querying OpenStreetMap…`);
  const q = `[out:json][timeout:120];(
    nwr["leisure"~"^(park|garden|playground)$"]["access"!="private"](${box});
    nwr["shop"~"^(supermarket|convenience|greengrocer)$"](${box});
    nwr["amenity"~"^(kindergarten|place_of_worship|community_centre)$"](${box});
  );out center tags;`;
  const res = await overpass<{ elements: OsmEl[] }>(q);

  const out: Array<{ id: string; type: PoiType; name: string; lon: number; lat: number }> = [];
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const el of res.elements ?? []) {
    const tags = el.tags ?? {};
    const type = classify(tags);
    if (!type) continue;
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (lon == null || lat == null) continue;
    // Unnamed gardens are mostly private yards / verges mapped as leisure=garden.
    const name = tags["name:he"] ?? tags.name ?? "";
    if (type === "park" && !name && tags.leisure === "garden") continue;
    const pt = turf.point([lon, lat]);
    const inside = fc.features.some(
      (f) => turf.booleanPointInPolygon(pt, f) || turf.pointToPolygonDistance(pt, f, { units: "kilometers" }) <= EDGE_KM,
    );
    if (!inside) continue;
    // The same place is often mapped twice (node + outline); dedupe by type + ~30m cell + name.
    const key = `${type}|${name}|${lon.toFixed(3)}|${lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `osm-${el.type[0]}${el.id}`,
      type,
      name: name || DEFAULT_NAME[type],
      lon: Math.round(lon * 1e5) / 1e5,
      lat: Math.round(lat * 1e5) / 1e5,
    });
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const outName = `${city.id}.pois.json`;
  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify({
      meta: { source: "OpenStreetMap contributors (ODbL)", city: city.id, as_of: new Date().toISOString().slice(0, 10), counts },
      pois: out,
    }) + "\n",
    "utf8",
  );
  console.log(`→ wrote public/${outName} — ${out.length} places ${JSON.stringify(counts)}`);
  return true;
}

async function main() {
  const all = process.argv.includes("--all");
  const i = process.argv.indexOf("--city");
  const ids = all ? Object.keys(CITIES).filter((id) => id !== "mevomodiim") : i >= 0 ? [process.argv[i + 1]] : [];
  if (!ids.length) {
    console.error(`Usage: npx tsx scripts/ingest/pois.ts --city <id> | --all`);
    process.exit(1);
  }
  let failed = 0;
  for (const id of ids) {
    const city = CITIES[id];
    if (!city) {
      console.error(`Unknown city "${id}".`);
      failed++;
      continue;
    }
    try {
      if (!(await buildCity(city))) failed++;
    } catch (e) {
      console.error(`✗ ${id}: ${(e as Error).message}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Real bus stops from the Open Bus "Stride" API (Hasadna, built on the Ministry
 * of Transport GTFS feed), per city. The app previously had only 2 transit POIs
 * (train stations); this adds every bus stop so the "תחבורה" map layer is real.
 *
 * Stride returns one row per stop PER DATE, so we pin a single service date and
 * dedupe by stop `code`. We clip to the city's own bounding box (derived from
 * its polygon file) so a fuzzy Stride city-match can't drag in a neighbor's
 * stops. Output is a static file added as type="transit" map POIs in
 * assembleConcierge (no DB migration).
 *
 * Usage:
 *   npm run ingest:transit                 # default city (modiin)
 *   npx tsx scripts/ingest/transit.ts --city oryehuda
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CITIES } from "./cities";

type Stop = { code: number; name: string; lat: number; lon: number; date: string };

async function fetchStops(city: string, date: string): Promise<Stop[]> {
  const url =
    `https://open-bus-stride-api.hasadna.org.il/gtfs_stops/list` +
    `?city=${encodeURIComponent(city)}&date_from=${date}&date_to=${date}&limit=5000`;
  const res = await fetch(url, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`Stride: ${res.status} ${res.statusText}`);
  return (await res.json()) as Stop[];
}

/** [west, south, east, north] over a city's polygon file, expanded by `margin`. */
function bboxOfGeo(geoFile: string, margin = 0.01): { west: number; south: number; east: number; north: number } {
  const geo = JSON.parse(readFileSync(resolve(process.cwd(), geoFile), "utf8")) as {
    features: Array<{ geometry: { coordinates: number[][][] } }>;
  };
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const f of geo.features) {
    for (const ring of f.geometry.coordinates) {
      for (const [lng, lat] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }
  return { west: west - margin, south: south - margin, east: east + margin, north: north + margin };
}

/** Most recent service date with data (walk back a few days if today is empty). */
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
  const CITY = city.gtfsCityName ?? city.id; // GTFS spelling: spaces, no hyphens
  const BBOX = bboxOfGeo(city.outFile);
  const outName = city.transitOut ?? `${city.id}.transit.json`;

  let stops: Stop[] = [];
  const today = new Date();
  for (let back = 0; back < 7 && stops.length === 0; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);
    console.log(`→ fetching Stride bus stops for ${CITY} ${iso}…`);
    stops = await fetchStops(CITY, iso);
  }
  if (stops.length === 0) throw new Error("Stride returned no stops for the last 7 days");

  // Dedupe by code, keep only stops inside the city bbox.
  const byCode = new Map<number, Stop>();
  for (const s of stops) {
    if (s.lon < BBOX.west || s.lon > BBOX.east || s.lat < BBOX.south || s.lat > BBOX.north) continue;
    if (!byCode.has(s.code)) byCode.set(s.code, s);
  }
  const clean = [...byCode.values()].map((s) => ({
    code: s.code,
    name: s.name,
    lat: Math.round(s.lat * 1e6) / 1e6,
    lon: Math.round(s.lon * 1e6) / 1e6,
  }));

  const path = resolve(process.cwd(), "public", outName);
  writeFileSync(
    path,
    JSON.stringify(
      { meta: { source: "Open Bus Stride (MoT GTFS) · hasadna", city: CITY, as_of: stops[0]?.date ?? null }, stops: clean },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`✓ wrote public/${outName} — ${clean.length} bus stops`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

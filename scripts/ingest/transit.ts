/**
 * Real Modi'in bus stops from the Open Bus "Stride" API (Hasadna, built on the
 * Ministry of Transport GTFS feed). The app previously had only 2 transit POIs
 * (train stations); this adds every bus stop so the "תחבורה" map layer is real.
 *
 * Stride returns one row per stop PER DATE, so we pin a single service date and
 * dedupe by stop `code`. Output is a static file added as type="transit" map
 * POIs in assembleConcierge (no DB migration).
 *
 * Usage:  npm run ingest:transit
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CITY = "מודיעין מכבים רעות"; // GTFS spelling: spaces, no hyphens
const BBOX = { west: 34.97, east: 35.06, south: 31.87, north: 31.93 };

type Stop = { code: number; name: string; lat: number; lon: number; date: string };

async function fetchStops(date: string): Promise<Stop[]> {
  const url =
    `https://open-bus-stride-api.hasadna.org.il/gtfs_stops/list` +
    `?city=${encodeURIComponent(CITY)}&date_from=${date}&date_to=${date}&limit=5000`;
  const res = await fetch(url, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`Stride: ${res.status} ${res.statusText}`);
  return (await res.json()) as Stop[];
}

/** Most recent service date with data (walk back a few days if today is empty). */
async function main() {
  let stops: Stop[] = [];
  const today = new Date();
  for (let back = 0; back < 7 && stops.length === 0; back++) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    const iso = d.toISOString().slice(0, 10);
    console.log(`→ fetching Stride bus stops for ${iso}…`);
    stops = await fetchStops(iso);
  }
  if (stops.length === 0) throw new Error("Stride returned no stops for the last 7 days");

  // Dedupe by code, keep only stops inside Modi'in.
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

  const path = resolve(process.cwd(), "public", "transit.modiin.json");
  writeFileSync(
    path,
    JSON.stringify(
      { meta: { source: "Open Bus Stride (MoT GTFS) · hasadna", city: CITY, as_of: stops[0]?.date ?? null }, stops: clean },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(`✓ wrote public/transit.modiin.json — ${clean.length} bus stops`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * NYC POC — subway stations from the MTA's tabular station list
 * (data.ny.gov 39hk-dx4f). No GTFS parsing, no API key.
 *
 * Output shape matches the app's BusStop loader ({code,name,lat,lon}) so the
 * existing transit map layer renders these unchanged.
 *
 * Usage:  npx tsx scripts/ingest/nyc_transit.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";

const URL_STATIONS = "https://data.ny.gov/resource/39hk-dx4f.json?$limit=2000";

type Station = { gtfs_stop_id?: string; stop_name?: string; daytime_routes?: string; gtfs_latitude?: string; gtfs_longitude?: string; borough?: string };

async function main() {
  const geoPath = resolve(process.cwd(), "public", "neighborhoods.nyc.geo.json");
  if (!existsSync(geoPath)) throw new Error("run nyc_geo.ts first");
  const geo = JSON.parse(readFileSync(geoPath, "utf8")) as { features: Array<{ geometry: any }> };
  const bbox = turf.bbox(turf.featureCollection(geo.features.map((f) => turf.feature(f.geometry)) as never));
  const M = 0.004; // ~400m margin so stations just outside a polygon still show

  console.log("→ fetching MTA subway stations (data.ny.gov 39hk-dx4f)…");
  const res = await fetch(URL_STATIONS, { headers: { Accept: "application/json", "User-Agent": "MishpachaMap/0.1" } });
  if (!res.ok) throw new Error(`MTA: ${res.status} ${res.statusText}`);
  const all = (await res.json()) as Station[];

  const seen = new Set<string>();
  const stops = all
    .map((s) => ({
      code: Number(String(s.gtfs_stop_id ?? "").replace(/\D/g, "")) || 0,
      name: `${s.stop_name ?? ""}${s.daytime_routes ? ` (${s.daytime_routes})` : ""}`.trim(),
      lat: Number(s.gtfs_latitude),
      lon: Number(s.gtfs_longitude),
      key: `${s.stop_name}|${s.gtfs_latitude}`,
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .filter((s) => s.lon >= bbox[0] - M && s.lon <= bbox[2] + M && s.lat >= bbox[1] - M && s.lat <= bbox[3] + M)
    .filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true)))
    .map(({ key, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars

  writeFileSync(
    resolve(process.cwd(), "public", "nyc.transit.json"),
    JSON.stringify({ meta: { source: "MTA Subway Stations (data.ny.gov 39hk-dx4f)", note: "subway stations; bus stops via GTFS not included in the POC" }, stops }, null, 2) + "\n",
    "utf8",
  );
  console.log(`✓ wrote public/nyc.transit.json — ${stops.length} subway stations in the POC area`);
  console.log(`  e.g. ${stops.slice(0, 5).map((s) => s.name).join(" · ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

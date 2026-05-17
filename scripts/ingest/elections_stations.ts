/**
 * Polling-station-level Knesset ingest, spatially joined to our neighborhood
 * polygons. Bechirot.gov.il publishes one CSV row per (city × ballot box)
 * with raw vote counts per party — no neighborhood mapping. This script
 * does the join automatically given station coordinates.
 *
 *   pnpm ingest:elections:stations -- <results-csv> <stations-csv> [--election=knesset-25] [--replace]
 *
 * Required inputs:
 *
 *   results-csv  — per-station CSV from bechirot.gov.il. Headers expected:
 *                    קוד עיר | סמל קלפי | <party_short>... (one column per party)
 *                  Other columns (בזב, מצביעים, פסולים, כשרים) are ignored.
 *                  Modi'in city code is 1200; only those rows are kept.
 *
 *   stations-csv — your local mapping of polling stations to coordinates:
 *                    סמל קלפי,lat,lng
 *                  This is the one-time hand-curation step — addresses
 *                  rarely include lat/lng and geocoding hundreds of "בית ספר X,
 *                  מודיעין" entries is unreliable. Pasting from Google Maps
 *                  is more accurate.
 *
 * Party-column mapping uses the bechirot "אות פתק" (ballot letter) → our
 * party_id. The PARTY_LETTER_MAP below covers the 25th Knesset; extend it
 * for future elections.
 *
 * Output: groups votes by neighborhood via ST_Contains, writes to
 * neighborhood_election_results with pct pre-computed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sb } from "./_env";
import { parseCsv } from "../../lib/csv";

const MODIIN_CITY_CODE = "1200";

/**
 * Knesset 25 ballot-letter → our internal party_id. Letters come from the
 * "אות" / "ballot" column on bechirot.gov.il. Add new entries when the
 * parties table grows.
 */
const PARTY_LETTER_MAP: Record<string, string> = {
  מחל: "likud",
  פה:   "yeshatid",
  ט:    "religious_zionism",
  כן:  "national_unity",
  שס:  "shas",
  ג:    "utj",
  ל:    "israel_beytenu",
  אמת: "labor",
  עם:  "raam",
  ום:  "hadash_taal",
  מרצ: "meretz",
};

type Args = {
  resultsFile: string;
  stationsFile: string;
  electionId: string;
  replace: boolean;
};

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let electionId = "knesset-25";
  let replace = false;
  for (const a of argv) {
    if (a.startsWith("--election=")) electionId = a.slice("--election=".length);
    else if (a === "--replace") replace = true;
    else if (!a.startsWith("--")) positional.push(a);
  }
  if (positional.length < 2) {
    throw new Error(
      "Usage: pnpm ingest:elections:stations -- <results-csv> <stations-csv> [--election=<id>] [--replace]",
    );
  }
  return {
    resultsFile: positional[0],
    stationsFile: positional[1],
    electionId,
    replace,
  };
}

function normalise(h: string): string {
  return h.replace(/\s+/g, " ").trim();
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[, ]/g, "").trim();
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Read the stations file: סמל קלפי, lat, lng (Hebrew or English headers). */
function loadStationCoords(path: string): Map<string, { lat: number; lng: number }> {
  const grid = parseCsv(readFileSync(path, "utf8"));
  if (grid.length < 2) throw new Error(`${path}: no rows`);
  const [headers, ...rows] = grid;
  const norm = headers.map(normalise);
  const findIdx = (...names: string[]) => norm.findIndex((h) => names.includes(h));
  const ci = findIdx("סמל קלפי", "קלפי", "station_id", "station");
  const lati = findIdx("lat", "latitude", "קו רוחב");
  const lngi = findIdx("lng", "lon", "longitude", "קו אורך");
  if (ci < 0 || lati < 0 || lngi < 0) {
    throw new Error(`${path}: need columns סמל קלפי + lat + lng (got: ${norm.join(", ")})`);
  }
  const out = new Map<string, { lat: number; lng: number }>();
  for (const r of rows) {
    const id = r[ci]?.trim();
    const lat = Number(r[lati]);
    const lng = Number(r[lngi]);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.set(id, { lat, lng });
  }
  return out;
}

/** Resolve (lng, lat) → neighborhood id by PostGIS ST_Contains. */
async function neighborhoodFor(lng: number, lat: number): Promise<string | null> {
  const { data, error } = await sb.rpc("neighborhood_at", { lng_in: lng, lat_in: lat });
  if (error) {
    // Helpful fallback when the RPC isn't installed — fall back to a direct
    // query that does the same thing inline.
    if (error.message.includes("Could not find the function")) {
      return await neighborhoodForFallback(lng, lat);
    }
    throw new Error(`neighborhood_at(${lng},${lat}): ${error.message}`);
  }
  return (data as string | null) ?? null;
}

/** Pure-SQL fallback: scan neighborhoods, return the first whose polygon
 *  contains the point. Slow at scale, fine for ~30 stations × 14 polygons. */
async function neighborhoodForFallback(lng: number, lat: number): Promise<string | null> {
  const { data, error } = await sb
    .from("neighborhoods_geojson")
    .select("id, polygon");
  if (error) throw new Error(error.message);
  for (const n of data ?? []) {
    const poly = n.polygon as GeoJSON.Polygon;
    if (pointInPolygon([lng, lat], poly)) return n.id as string;
  }
  return null;
}

/** Ray-casting point-in-polygon for the fallback path. Handles the first
 *  ring only (outer boundary). */
function pointInPolygon(point: [number, number], polygon: GeoJSON.Polygon): boolean {
  const [x, y] = point;
  const ring = polygon.coordinates?.[0] ?? [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const coords = loadStationCoords(resolve(process.cwd(), args.stationsFile));
  console.log(`→ loaded ${coords.size} polling-station coordinates`);

  const text = readFileSync(resolve(process.cwd(), args.resultsFile), "utf8");
  const grid = parseCsv(text);
  if (grid.length < 2) throw new Error("results CSV has no rows");
  const [headers, ...rows] = grid;
  const norm = headers.map(normalise);

  const cityCol = norm.findIndex((h) => ["קוד עיר", "סמל ישוב"].includes(h));
  const stationCol = norm.findIndex((h) => ["סמל קלפי", "קלפי"].includes(h));
  if (cityCol < 0 || stationCol < 0) {
    throw new Error(`results CSV: need קוד עיר/סמל ישוב + סמל קלפי (got: ${norm.join(", ")})`);
  }

  // Each remaining column whose header matches PARTY_LETTER_MAP becomes a
  // party-votes column. Letters can appear with or without surrounding
  // whitespace; we trim before lookup.
  const partyCols: { idx: number; partyId: string }[] = [];
  norm.forEach((h, idx) => {
    const partyId = PARTY_LETTER_MAP[h];
    if (partyId) partyCols.push({ idx, partyId });
  });
  console.log(`→ detected ${partyCols.length} party columns in results`);

  // Aggregate: neighborhood × party → votes.
  const agg = new Map<string, Map<string, number>>();
  const unmatched: string[] = [];
  let kept = 0;

  for (const r of rows) {
    if (r[cityCol]?.trim() !== MODIIN_CITY_CODE) continue;
    const stationId = r[stationCol]?.trim();
    if (!stationId) continue;
    const coord = coords.get(stationId);
    if (!coord) {
      unmatched.push(stationId);
      continue;
    }
    const nbId = await neighborhoodFor(coord.lng, coord.lat);
    if (!nbId) {
      unmatched.push(`${stationId} (outside polygons)`);
      continue;
    }
    kept++;
    const bucket = agg.get(nbId) ?? new Map<string, number>();
    for (const { idx, partyId } of partyCols) {
      const v = parseNumber(r[idx]);
      if (v > 0) bucket.set(partyId, (bucket.get(partyId) ?? 0) + v);
    }
    agg.set(nbId, bucket);
  }

  console.log(`✓ kept ${kept} stations across ${agg.size} neighborhoods`);
  if (unmatched.length > 0) {
    console.warn(`  · ${unmatched.length} station(s) skipped (no coords / outside polygons):`);
    for (const s of unmatched.slice(0, 10)) console.warn(`     - ${s}`);
    if (unmatched.length > 10) console.warn(`     … and ${unmatched.length - 10} more`);
  }

  type Out = { neighborhood: string; election: string; party: string; votes: number; pct: number };
  const out: Out[] = [];
  for (const [nbId, byParty] of agg.entries()) {
    const total = Array.from(byParty.values()).reduce((s, v) => s + v, 0);
    if (total === 0) continue;
    for (const [partyId, votes] of byParty.entries()) {
      out.push({
        neighborhood: nbId,
        election: args.electionId,
        party: partyId,
        votes,
        pct: Number(((votes / total) * 100).toFixed(2)),
      });
    }
  }

  if (out.length === 0) {
    console.warn("Nothing to upsert.");
    return;
  }

  if (args.replace) {
    const { error } = await sb
      .from("neighborhood_election_results")
      .delete()
      .eq("election", args.electionId);
    if (error) throw new Error(`delete: ${error.message}`);
    console.log(`✓ cleared existing rows for election=${args.electionId}`);
  }

  const { error } = await sb.from("neighborhood_election_results").upsert(out);
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log(`✓ inserted ${out.length} (neighborhood × party) rows for ${args.electionId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

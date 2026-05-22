/**
 * Stage 2 of the elections-station ingest pipeline.
 *
 * Reads the CSV produced by elections_extract_stations.ts (one row per
 * polling station with place_name + street + city_name) and resolves each
 * to (lat, lng) via Mapbox Geocoding API. Filters by confidence — anything
 * below the relevance threshold is dropped so the downstream spatial join
 * doesn't assign it to a wrong neighborhood.
 *
 * Output: stations_<city>_k25_geocoded.csv with columns
 *   kalpi, lat, lng, relevance, resolved_text
 * which the existing scripts/ingest/elections_stations.ts script consumes.
 *
 * Usage:
 *   npm run ingest:elections:geocode -- [--in=path] [--out=path] [--min-relevance=0.8]
 *
 * Requires MAPBOX_SERVER_TOKEN (or MAPBOX_TOKEN) in .env.local. Don't use
 * NEXT_PUBLIC_MAPBOX_TOKEN — it's URL-restricted and Mapbox rejects server-
 * to-server calls without a matching Referer header.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import "./_env";
import { parseCsv } from "../../lib/csv";

const MAPBOX_TOKEN =
  process.env.MAPBOX_SERVER_TOKEN ?? process.env.MAPBOX_TOKEN ?? "";

if (!MAPBOX_TOKEN) {
  console.error(
    "missing MAPBOX_SERVER_TOKEN in .env.local — see comment at top of file",
  );
  process.exit(1);
}

type Args = {
  inPath: string;
  outPath: string;
  minRelevance: number;
};

function parseArgs(argv: string[]): Args {
  let inPath = "data/elections/stations_1200_k25.csv";
  let outPath = "";
  // 0.5 is the floor where Mapbox's street resolutions are still reliably
  // the right city; lower than that we see "מודיעין" treated as a street
  // name in Jerusalem / Tel Aviv etc. The post-filter on resolved city
  // does the heavy lifting; this threshold is a backstop.
  let minRelevance = 0.5;
  for (const a of argv) {
    if (a.startsWith("--in=")) inPath = a.slice("--in=".length);
    else if (a.startsWith("--out=")) outPath = a.slice("--out=".length);
    else if (a.startsWith("--min-relevance="))
      minRelevance = Number(a.slice("--min-relevance=".length));
  }
  if (!outPath) outPath = inPath.replace(/\.csv$/, "_geocoded.csv");
  return { inPath, outPath, minRelevance };
}

type Row = {
  kalpi: string;
  city_code: string;
  city_name: string;
  place_name: string;
  street: string;
};

function loadStations(path: string): Row[] {
  const text = readFileSync(path, "utf8");
  const grid = parseCsv(text);
  if (grid.length < 2) return [];
  const headers = grid[0];
  const idx = (name: string) => headers.indexOf(name);
  const cols = {
    kalpi: idx("קלפי") >= 0 ? idx("קלפי") : idx("kalpi"),
    city_code: idx("city_code"),
    city_name: idx("city_name"),
    place_name: idx("place_name"),
    street: idx("street"),
  };
  return grid.slice(1).map((r) => ({
    kalpi: r[cols.kalpi] ?? "",
    city_code: r[cols.city_code] ?? "",
    city_name: r[cols.city_name] ?? "",
    place_name: r[cols.place_name] ?? "",
    street: r[cols.street] ?? "",
  }));
}

type GeocodeHit = {
  lat: number;
  lng: number;
  relevance: number;
  resolved_text: string;
};

/**
 * The CEC street field comes formatted as "<name>,<number> " (with a trailing
 * space). Parse into clean "<number> <name>" suitable for Mapbox.
 */
function normalizeStreet(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(.+?),\s*(\d+)\s*$/);
  if (m) return `${m[2]} ${m[1].trim()}`;
  return trimmed;
}

/**
 * Build candidate address queries in order of geocoder-friendliness. We
 * skip the school name (place_name) in the primary query — Mapbox's
 * string-match relevance treats unmatched school prefixes harshly even when
 * the resolved street is correct. Falls back to place_name only when the
 * street is empty.
 */
async function geocodeStation(
  row: Row,
  minRelevance: number,
  expectedCityFragments: string[],
): Promise<GeocodeHit | null> {
  const queries: string[] = [];
  const street = normalizeStreet(row.street);
  if (street && row.city_name) queries.push(`${street}, ${row.city_name}`);
  if (street) queries.push(street);
  if (row.place_name && row.city_name)
    queries.push(`${row.place_name}, ${row.city_name}`);

  let best: GeocodeHit | null = null;
  for (const q of queries) {
    const hit = await callMapbox(q);
    if (!hit) continue;
    // Post-filter: the resolved address must mention the expected city.
    // Protects against "מודיעין 15" being matched as a street in some other
    // city (Jerusalem / Tel Aviv / Rosh HaAyin all have these).
    const resolvedOk = expectedCityFragments.some((c) =>
      hit.resolved_text.includes(c),
    );
    if (!resolvedOk) continue;
    if (!best || hit.relevance > best.relevance) best = hit;
    if (best.relevance >= minRelevance) return best;
  }
  return best;
}

async function callMapbox(query: string): Promise<GeocodeHit | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "il");
  url.searchParams.set("language", "he");
  url.searchParams.set("limit", "1");
  // Bias toward central Israel so e.g. "רמון" resolves to a school not the
  // crater in the Negev.
  url.searchParams.set("proximity", "35.0,31.9");

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 429) {
      // Rate-limited; wait and retry once.
      await new Promise((r) => setTimeout(r, 2000));
      return callMapbox(query);
    }
    console.warn(`  mapbox ${res.status} for "${query}"`);
    return null;
  }
  const body = (await res.json()) as {
    features?: {
      center: [number, number];
      relevance: number;
      place_name: string;
    }[];
  };
  const f = body.features?.[0];
  if (!f) return null;
  return {
    lng: f.center[0],
    lat: f.center[1],
    relevance: f.relevance,
    resolved_text: f.place_name,
  };
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inAbs = resolve(process.cwd(), args.inPath);
  console.log(`→ loading stations from ${args.inPath}`);
  const rows = loadStations(inAbs);
  console.log(`  ${rows.length} stations to geocode`);

  const outRows: string[] = ["קלפי,lat,lng,relevance,resolved_text"];
  let kept = 0;
  let dropped = 0;

  // City-name fragments accepted in the resolved address. Mapbox returns
  // both Hebrew ("מודיעין-מכבים-רעות") and English ("Modiin-Maccabim-Reut").
  const expectedCityFragments = Array.from(
    new Set(rows.map((r) => r.city_name).filter(Boolean)),
  );
  // Add the most common English transliteration the API uses.
  const englishHints = ["Modiin", "Modi'in"];
  for (const h of englishHints) expectedCityFragments.push(h);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const hit = await geocodeStation(r, args.minRelevance, expectedCityFragments);
    if (!hit) {
      console.warn(`  ${r.kalpi}: no geocode hit (${r.place_name} ${r.street})`);
      dropped++;
      continue;
    }
    if (hit.relevance < args.minRelevance) {
      console.warn(
        `  ${r.kalpi}: relevance ${hit.relevance.toFixed(2)} < ${args.minRelevance}, dropping (${r.place_name} ${r.street} → ${hit.resolved_text})`,
      );
      dropped++;
      continue;
    }
    outRows.push(
      [r.kalpi, hit.lat.toFixed(6), hit.lng.toFixed(6), hit.relevance.toFixed(3), hit.resolved_text]
        .map(escapeCsv)
        .join(","),
    );
    kept++;
    if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${rows.length}`);
    // Small delay to stay polite to the API (Mapbox free tier is 600/min, but
    // bursts at 50/sec). We're nowhere near that; this is paranoia.
    await new Promise((r) => setTimeout(r, 50));
  }

  const outAbs = resolve(process.cwd(), args.outPath);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, "﻿" + outRows.join("\n"), "utf8");
  console.log(`✓ kept ${kept}, dropped ${dropped} (relevance < ${args.minRelevance})`);
  console.log(`  → ${args.outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Validate `public/neighborhoods.geo.json` after the user replaces it with
 * hand-drawn polygons from GeoJSON.io (or any other source).
 *
 * Checks:
 *   - File is parseable JSON, of type FeatureCollection
 *   - Every Feature has a Polygon (not MultiPolygon — convert before importing)
 *   - Every Feature has a `properties.id` matching one of our 13 canonical IDs
 *   - All vertices fall inside a generous Modi'in bbox
 *   - All 13 expected IDs are present (no missing, no extras)
 *
 * Usage: `npm run polygons:validate`
 *
 * Exits non-zero on any failure so the script can be wired into CI later.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const EXPECTED_IDS = [
  "hakramim",
  "hanevim",
  "hameginim",
  "haprachim",
  "avneichen",
  "hanechalim",
  "masuah",
  "hatsiporim",
  "nofim",
  "hashvatim",
  "hareut",
  "moriah",
  "hamakkabim",
  "moreshet",
] as const;

// Generous bbox covering Modi'in + Maccabim + Re'ut with margin.
const BBOX = {
  west: 34.93,
  south: 31.84,
  east: 35.08,
  north: 31.95,
};

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const path = join(process.cwd(), "public", "neighborhoods.geo.json");
let raw: string;
try {
  raw = readFileSync(path, "utf8");
} catch (e) {
  fail(`could not read ${path}: ${(e as Error).message}`);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  fail(`invalid JSON: ${(e as Error).message}`);
}

if (
  !parsed ||
  typeof parsed !== "object" ||
  (parsed as { type?: string }).type !== "FeatureCollection"
) {
  fail("root must be a GeoJSON FeatureCollection");
}

const fc = parsed as GeoJSON.FeatureCollection;

if (!Array.isArray(fc.features)) {
  fail("FeatureCollection.features must be an array");
}

const seenIds = new Set<string>();
const issues: string[] = [];

for (const f of fc.features) {
  if (f.type !== "Feature") {
    issues.push(`one feature is not type=Feature`);
    continue;
  }
  const props = (f.properties ?? {}) as { id?: string; name_he?: string };
  const id = props.id;

  if (!id || typeof id !== "string") {
    issues.push(`feature missing properties.id (name_he="${props.name_he ?? "?"}")`);
    continue;
  }

  if (!EXPECTED_IDS.includes(id as (typeof EXPECTED_IDS)[number])) {
    issues.push(`unknown id "${id}" — not in canonical list`);
  }

  if (seenIds.has(id)) {
    issues.push(`duplicate id "${id}"`);
  }
  seenIds.add(id);

  if (!f.geometry || f.geometry.type !== "Polygon") {
    issues.push(`${id}: expected Polygon, got ${f.geometry?.type ?? "null"}`);
    continue;
  }

  const polygon = f.geometry as GeoJSON.Polygon;
  if (!Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    issues.push(`${id}: empty coordinates`);
    continue;
  }

  const ring = polygon.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    issues.push(`${id}: ring needs at least 4 points (got ${ring?.length ?? 0})`);
    continue;
  }

  // Check ring is closed (first === last).
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) {
    issues.push(`${id}: ring is not closed (first !== last)`);
  }

  // Check all points in Modi'in bbox.
  for (const [lng, lat] of ring) {
    if (typeof lng !== "number" || typeof lat !== "number") {
      issues.push(`${id}: non-numeric coordinate found`);
      break;
    }
    if (lng < BBOX.west || lng > BBOX.east || lat < BBOX.south || lat > BBOX.north) {
      issues.push(
        `${id}: point [${lng.toFixed(4)}, ${lat.toFixed(4)}] outside Modi'in bbox`,
      );
      break;
    }
  }
}

// Missing IDs?
const missing = EXPECTED_IDS.filter((id) => !seenIds.has(id));
if (missing.length > 0) {
  issues.push(`missing IDs: ${missing.join(", ")}`);
}

if (issues.length > 0) {
  console.error(`✗ found ${issues.length} issue(s):\n`);
  for (const i of issues) console.error(`  - ${i}`);
  process.exit(1);
}

console.log(`✓ ${fc.features.length} features, all ${EXPECTED_IDS.length} canonical IDs present`);
console.log(`✓ all polygons inside Modi'in bbox`);
console.log(`✓ all rings closed`);
console.log(`\nReady to seed:  npm run ingest:seed`);

/**
 * Validate `public/neighborhoods.geo.json` before seeding.
 *
 * The actual rules live in `lib/validateNeighborhoods.ts` so this CLI and the
 * in-app save route (`app/api/admin/save-polygons`) enforce exactly the same
 * checks: FeatureCollection of Polygons, canonical ids (all present, none
 * extra/duplicate), closed rings ≥4 points, all vertices inside the Modi'in
 * bbox.
 *
 * Usage: `npm run polygons:validate`  (exits non-zero on any failure, for CI).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateNeighborhoodsFC,
  EXPECTED_NEIGHBORHOOD_IDS,
} from "../lib/validateNeighborhoods";

const path = join(process.cwd(), "public", "neighborhoods.geo.json");

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`✗ could not read/parse ${path}: ${(e as Error).message}`);
  process.exit(1);
}

const issues = validateNeighborhoodsFC(parsed);
if (issues.length > 0) {
  console.error(`✗ found ${issues.length} issue(s):\n`);
  for (const i of issues) console.error(`  - ${i}`);
  process.exit(1);
}

const fc = parsed as GeoJSON.FeatureCollection;
console.log(`✓ ${fc.features.length} features, all ${EXPECTED_NEIGHBORHOOD_IDS.length} canonical IDs present`);
console.log(`✓ all polygons are closed and inside the Modi'in bbox`);
console.log(`\nReady to seed:  npm run ingest:seed`);

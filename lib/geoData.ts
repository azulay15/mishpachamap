/**
 * Static-geo loader. Reads `public/neighborhoods.geo.json` — the source of
 * truth for neighborhood polygons. The DB only holds metadata (id, name,
 * summary, metrics, aliases); geometry lives here so it can be replaced with
 * CBS statistical areas or hand-drawn GeoJSON without a DB migration.
 *
 * Used by:
 *   - app/page.tsx (server-side, joined with DB metadata)
 *   - scripts/ingest/seed_neighborhoods.ts (keeps DB polygons in sync for
 *     PostGIS distance queries)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type NeighborhoodFeatureProperties = {
  id: string;
  name_he: string;
  name_en: string;
  osm_node?: number;
  center_source?: string;
};

export type NeighborhoodFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  NeighborhoodFeatureProperties
>;

export type NeighborhoodFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  NeighborhoodFeatureProperties
>;

/** Read the static GeoJSON file. Server-only — uses Node fs. */
export function loadNeighborhoodFeatures(): NeighborhoodFeatureCollection {
  const path = join(process.cwd(), "public", "neighborhoods.geo.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as NeighborhoodFeatureCollection;
}

/** Compute the centroid of a polygon (mean of outer-ring vertices). */
export function centroidOf(feature: NeighborhoodFeature): [number, number] {
  const ring = feature.geometry.coordinates[0];
  const pts = ring.slice(0, -1); // drop closing point
  const sx = pts.reduce((s, [x]) => s + x, 0);
  const sy = pts.reduce((s, [, y]) => s + y, 0);
  return [sx / pts.length, sy / pts.length];
}

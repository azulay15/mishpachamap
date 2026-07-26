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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultCity, type City } from "@/lib/cities";

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

const EMPTY_FC: NeighborhoodFeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Read a city's static GeoJSON polygons. Server-only — uses Node fs.
 * Defaults to the default city so existing no-arg callers (seed scripts) keep
 * working. A missing file (a not-yet-built "coming-soon" city) returns an empty
 * collection rather than throwing; a present-but-corrupt file still throws, so
 * a real data bug on a live city isn't silently swallowed.
 */
export function loadNeighborhoodFeatures(city: City = defaultCity()): NeighborhoodFeatureCollection {
  const path = join(process.cwd(), "public", city.files.geo);
  if (!existsSync(path)) return EMPTY_FC;
  return JSON.parse(readFileSync(path, "utf8")) as NeighborhoodFeatureCollection;
}

/** Compute the centroid of a polygon (mean of outer-ring vertices). */
export function centroidOf(feature: NeighborhoodFeature): [number, number] {
  const ring = feature.geometry.coordinates[0];
  const pts = ring.slice(0, -1); // drop closing point
  const sx = pts.reduce((s, [x]) => s + x, 0);
  const sy = pts.reduce((s, [, y]) => s + y, 0);
  return [sx / pts.length, sy / pts.length];
}

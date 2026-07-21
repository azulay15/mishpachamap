/**
 * Shared validation for `public/neighborhoods.geo.json`.
 *
 * Used by BOTH the CLI (`scripts/validate_polygons.ts`, run before seeding) and
 * the in-app save route (`app/api/admin/save-polygons`, which refuses to write a
 * broken file). Keeping the rules in one place means the editor can't save
 * something the CLI would later reject.
 */

/** The 14 canonical Modi'in neighborhood ids (the DB join key + GeoJSON id). */
export const EXPECTED_NEIGHBORHOOD_IDS = [
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

/** Generous bbox covering Modi'in + Maccabim + Re'ut with margin. */
export const MODIIN_BBOX = {
  west: 34.93,
  south: 31.84,
  east: 35.08,
  north: 31.95,
} as const;

export type BBox = { west: number; south: number; east: number; north: number };

export type ValidateOptions = {
  /** Ids that must all be present, with none extra. Defaults to Modi'in's 14. */
  expectedIds?: readonly string[];
  /** Every vertex must fall inside this box. Defaults to the Modi'in bbox. */
  bbox?: BBox;
};

/**
 * Returns a list of human-readable problems with `data` as a neighborhoods
 * FeatureCollection. An empty array means it is valid and safe to write/seed.
 */
export function validateNeighborhoodsFC(data: unknown, opts: ValidateOptions = {}): string[] {
  const expectedIds: readonly string[] = opts.expectedIds ?? EXPECTED_NEIGHBORHOOD_IDS;
  const bbox = opts.bbox ?? MODIIN_BBOX;
  const issues: string[] = [];

  if (!data || typeof data !== "object" || (data as { type?: string }).type !== "FeatureCollection") {
    return ["root must be a GeoJSON FeatureCollection"];
  }
  const fc = data as GeoJSON.FeatureCollection;
  if (!Array.isArray(fc.features)) {
    return ["FeatureCollection.features must be an array"];
  }

  const seenIds = new Set<string>();

  for (const f of fc.features) {
    if (!f || f.type !== "Feature") {
      issues.push("one feature is not type=Feature");
      continue;
    }
    const props = (f.properties ?? {}) as { id?: string; name_he?: string };
    const id = props.id;

    if (!id || typeof id !== "string") {
      issues.push(`feature missing properties.id (name_he="${props.name_he ?? "?"}")`);
      continue;
    }
    if (!expectedIds.includes(id)) {
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

    // Closed ring (first === last).
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) {
      issues.push(`${id}: ring is not closed (first !== last)`);
    }

    // All vertices in bbox.
    for (const [lng, lat] of ring) {
      if (typeof lng !== "number" || typeof lat !== "number") {
        issues.push(`${id}: non-numeric coordinate found`);
        break;
      }
      if (lng < bbox.west || lng > bbox.east || lat < bbox.south || lat > bbox.north) {
        issues.push(`${id}: point [${lng.toFixed(4)}, ${lat.toFixed(4)}] outside bbox`);
        break;
      }
    }
  }

  const missing = expectedIds.filter((id) => !seenIds.has(id));
  if (missing.length > 0) {
    issues.push(`missing IDs: ${missing.join(", ")}`);
  }

  return issues;
}

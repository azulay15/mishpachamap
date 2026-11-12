import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import { CITIES as BUILD_CITIES } from "../scripts/ingest/cities";

/**
 * Neighborhood ids must be globally unique: favorites, ?n= deep links, the DB
 * metrics fallback and arnona rates are all keyed by the bare id, so two cities
 * sharing one cross-wire their data.
 *
 * These three collisions predate the check. They're listed so the test guards
 * every NEW city without renaming existing ids (that needs a migration of saved
 * favorites + DB rows). Delete an entry once it's fixed.
 */
const LEGACY_COLLISIONS = new Set([
  "haprachim (modiin + kefarsava)",
  "rishonim (rishon + kefarsava)",
  "kiryat-ganim (rishon + raanana)",
]);

function idsOf(geoFile: string): string[] {
  const path = join(process.cwd(), "public", geoFile);
  if (!existsSync(path)) return [];
  const fc = JSON.parse(readFileSync(path, "utf8")) as { features: Array<{ properties: { id: string } }> };
  return fc.features.map((f) => f.properties.id);
}

describe("neighborhood ids", () => {
  const byCity = CITIES.map((c) => ({ city: c.id, ids: idsOf(c.files.geo) }));

  it("are unique within each city", () => {
    for (const { city, ids } of byCity) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes, city).toEqual([]);
    }
  });

  it("are unique across cities, apart from the known legacy collisions", () => {
    const owner = new Map<string, string>();
    const collisions: string[] = [];
    for (const { city, ids } of byCity) {
      for (const id of new Set(ids)) {
        const prev = owner.get(id);
        if (prev && prev !== city) collisions.push(`${id} (${prev} + ${city})`);
        else owner.set(id, city);
      }
    }
    const unexpected = collisions.filter((c) => !LEGACY_COLLISIONS.has(c));
    expect(unexpected).toEqual([]);
  });
});

describe("city registries", () => {
  it("agree on each city's output basenames (scripts/ingest/cities.ts ↔ lib/cities.ts)", () => {
    for (const app of CITIES) {
      const build = BUILD_CITIES[app.id];
      if (!build) continue; // e.g. NYC is built by its own scripts
      expect(build.outFile, app.id).toBe(`public/${app.files.geo}`);
      expect(build.demographicsOut, app.id).toBe(app.files.demographics);
      expect(build.crimeOut, app.id).toBe(app.files.crime);
      expect(build.schoolsOut, app.id).toBe(app.files.schools);
      expect(build.transitOut, app.id).toBe(app.files.transit);
      expect(build.environmentOut, app.id).toBe(app.files.environment);
      expect(build.pricesOut, app.id).toBe(app.files.prices);
      expect(build.semelYishuv, app.id).toBe(app.semel);
    }
  });
});

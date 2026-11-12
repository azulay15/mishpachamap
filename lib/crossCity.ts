/**
 * Server-only: one index of every neighborhood in every live Israeli city,
 * built from the cities' static files (no DB). Feeds the "more for less"
 * search, which compares neighborhoods ACROSS cities.
 *
 * Built once per server process and kept in memory — the inputs are static
 * files that only change on deploy.
 */
import { liveCities } from "@/lib/cities";
import { centroidOf, loadNeighborhoodFeatures } from "@/lib/geoData";
import { loadEnvironment, loadMarket, loadSafety, loadSchools } from "@/lib/staticData";
import { haversineKm, type IndexNeighborhood } from "@/lib/alternatives";

/** Schools this close to the neighborhood centre count as "its" schools. */
const SCHOOL_KM = 1.2;

let cache: IndexNeighborhood[] | null = null;

export function crossCityIndex(): IndexNeighborhood[] {
  if (cache) return cache;
  const out: IndexNeighborhood[] = [];
  for (const city of liveCities()) {
    if (city.country === "US") continue;
    const features = loadNeighborhoodFeatures(city).features;
    if (features.length === 0) continue;
    const market = loadMarket(city).neighborhoods;
    const env = loadEnvironment(city);
    const safety = loadSafety(city);
    const scored = loadSchools(city).filter((s) => s.meitzav_score != null && s.lon != null && s.lat != null);
    for (const f of features) {
      const id = f.properties.id;
      const center = centroidOf(f);
      const near = scored.filter((s) => haversineKm(center, [s.lon as number, s.lat as number]) <= SCHOOL_KM);
      const m = market[id];
      out.push({
        id,
        he: f.properties.name_he,
        cityId: city.id,
        citySlug: city.slug,
        cityHe: city.searchName ?? city.name_he,
        center,
        rent: m?.rent ?? {},
        buy: m?.buy ?? {},
        green: env[id]?.green_score ?? null,
        schools: near.length
          ? Math.round(near.reduce((sum, s) => sum + (s.meitzav_score as number), 0) / near.length)
          : null,
        safety: safety[id]?.safety_score ?? null,
      });
    }
  }
  cache = out;
  return out;
}

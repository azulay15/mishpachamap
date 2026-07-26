/**
 * QA report for a city's built data — per-layer coverage + a "review these"
 * list of the uncertain bits, so vetting a new city is a glance, not an audit.
 *
 * Usage:  npm run city:qa -- --city oryehuda
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CITIES, type CityConfig } from "./cities";

/* eslint-disable @typescript-eslint/no-explicit-any */
function readJson(file: string): any | null {
  const p = resolve(process.cwd(), file.startsWith("public/") ? file : `public/${file}`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function pct(n: number, of: number): string {
  return of === 0 ? "—" : `${Math.round((n / of) * 100)}%`;
}
function bar(n: number, of: number, flagBelow = 0.5): string {
  const p = of === 0 ? 0 : n / of;
  return `${String(n).padStart(3)}/${String(of).padEnd(3)} ${p >= flagBelow ? "✓" : "⚠"}`;
}

function main() {
  const cityArg = (() => {
    const i = process.argv.indexOf("--city");
    return i >= 0 ? process.argv[i + 1] : "";
  })();
  const city: CityConfig | undefined = CITIES[cityArg];
  if (!city) {
    console.error(`Usage: npm run city:qa -- --city <id>   (known: ${Object.keys(CITIES).join(", ")})`);
    process.exit(1);
  }

  const geo = readJson(city.outFile);
  if (!geo?.features?.length) {
    console.error(`✗ no polygons at ${city.outFile} — run "npm run city:build -- --city ${city.id}" first.`);
    process.exit(1);
  }
  const feats: any[] = geo.features;
  const ids: string[] = feats.map((f) => f.properties.id);
  const N = ids.length;
  const nameOf = new Map<string, string>(feats.map((f) => [f.properties.id, f.properties.name_he]));

  const demo = readJson(city.demographicsOut ?? `${city.id}.demographics.json`)?.neighborhoods ?? {};
  const crime = readJson(city.crimeOut ?? `${city.id}.crime.json`)?.neighborhoods ?? {};
  const env = readJson(city.environmentOut ?? `${city.id}.environment.json`)?.neighborhoods ?? {};
  const prices = readJson(city.pricesOut ?? `${city.id}.prices.json`)?.neighborhoods ?? {};
  const schools: any[] = readJson(city.schoolsOut ?? `${city.id}.schools.json`)?.schools ?? [];
  const transit: any[] = readJson(city.transitOut ?? `${city.id}.transit.json`)?.stops ?? [];

  const withDemo = ids.filter((id) => demo[id] != null);
  const withSafety = ids.filter((id) => crime[id]?.safety_score != null);
  const withEnv = ids.filter((id) => env[id] != null);
  const withPrice = ids.filter((id) => prices[id]?.avg_price_per_m2 != null);
  const geocoded = schools.filter((s) => s.lon != null).length;
  const meitzav = schools.filter((s) => s.meitzav_score != null).length;

  console.log(`\n===== QA · ${city.id} (semel ${city.semelYishuv}) · ${N} neighborhoods =====\n`);
  console.log("Layer coverage (neighborhood-level):");
  console.log(`  demographics   ${bar(withDemo.length, N)}   (CBS census)`);
  console.log(`  green/quiet    ${bar(withEnv.length, N)}   (OSM)`);
  console.log(`  prices         ${bar(withPrice.length, N)}   (Govmap)`);
  console.log(`  safety         ${bar(withSafety.length, N)}   (Police)`);
  console.log("\nCity-wide layers:");
  console.log(`  schools        ${schools.length} total · ${geocoded} geocoded (${pct(geocoded, schools.length)}) · ${meitzav} with מיצ״ב`);
  console.log(`  transit        ${transit.length} bus stops`);

  // Per-neighborhood completeness across the 4 neighborhood-level layers.
  const completeness = (id: string) =>
    [demo[id] != null, env[id] != null, prices[id]?.avg_price_per_m2 != null, crime[id]?.safety_score != null].filter(Boolean).length;
  const thin = ids.filter((id) => completeness(id) <= 1);

  const green0 = ids.filter((id) => env[id]?.green_score === 0);
  const tinyPoly = feats.filter((f) => (f.geometry.coordinates?.[0]?.length ?? 0) < 12).map((f) => f.properties.id);
  const label = (id: string) => `${nameOf.get(id) ?? id}`;
  const list = (arr: string[]) => (arr.length ? arr.map(label).join(", ") : "(none)");

  console.log(`\n⚠ Review:`);
  console.log(`  • No demographics (${N - withDemo.length}): ${list(ids.filter((id) => demo[id] == null))}`);
  console.log(`  • No price data   (${N - withPrice.length}): ${list(ids.filter((id) => prices[id]?.avg_price_per_m2 == null))}`);
  console.log(`  • No safety data  (${N - withSafety.length}): ${list(ids.filter((id) => crime[id]?.safety_score == null))}   (no police area OR suppressed as implausible)`);
  console.log(`  • GreenScore = 0  (${green0.length}): ${list(green0)}   (no OSM green detected — verify)`);
  console.log(`  • Thin (≤1 of 4 layers) (${thin.length}): ${list(thin)}`);
  console.log(`  • Tiny polygon (<12 verts) (${tinyPoly.length}): ${list(tinyPoly)}   (possible build/clip issue)`);

  // A single headline "is this city shippable" heuristic.
  const ok = withDemo.length >= N * 0.7 && withEnv.length >= N * 0.7 && schools.length > 0 && transit.length > 0;
  console.log(`\n${ok ? "✓ Looks shippable" : "⚠ Below the bar"} — demographics ${pct(withDemo.length, N)}, green ${pct(withEnv.length, N)}, ${schools.length} schools, ${transit.length} stops.`);
  console.log(`  (prices/safety are expected to be partial — honest empty states cover the gaps.)\n`);
}

main();

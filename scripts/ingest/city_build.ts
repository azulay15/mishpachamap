/**
 * Run the whole data pipeline for one city, in dependency order, with a
 * pass/fail summary. Replaces running seven ingests by hand.
 *
 * Usage:  npm run city:build -- --city rishon
 * (Add the city to scripts/ingest/cities.ts + lib/cities.ts first — see
 *  `npm run city:scaffold` to draft that config.)
 */
import { spawnSync } from "node:child_process";
import { CITIES } from "./cities";

const STEPS: Array<{ name: string; script: string; required?: boolean; slow?: boolean }> = [
  { name: "polygons", script: "build_neighborhoods", required: true }, // everything joins on the geo file
  { name: "demographics", script: "demographics" }, // needed by safety (population)
  { name: "transit", script: "transit" },
  { name: "green/quiet", script: "environment" },
  { name: "schools", script: "schools_moe" },
  { name: "prices", script: "prices", slow: true }, // Govmap — minutes for a big city
  { name: "safety", script: "crime" },
];

function main() {
  const cityArg = (() => {
    const i = process.argv.indexOf("--city");
    return i >= 0 ? process.argv[i + 1] : "";
  })();
  const city = CITIES[cityArg];
  if (!city) {
    console.error(`Usage: npm run city:build -- --city <id>   (known: ${Object.keys(CITIES).join(", ")})`);
    process.exit(1);
  }

  console.log(`\n═══ building all data for ${city.id} (semel ${city.semelYishuv}) ═══`);
  const results: Array<{ name: string; ok: boolean; secs: number }> = [];
  for (const step of STEPS) {
    console.log(`\n━━━ ${step.name}${step.slow ? "  (slow — Govmap)" : ""} ━━━`);
    const t0 = Date.now();
    const r = spawnSync(`npx tsx scripts/ingest/${step.script}.ts --city ${city.id}`, {
      stdio: "inherit",
      shell: true,
    });
    const ok = r.status === 0;
    results.push({ name: step.name, ok, secs: (Date.now() - t0) / 1000 });
    if (!ok && step.required) {
      console.error(`\n✗ "${step.name}" failed and later steps depend on it — stopping.`);
      break;
    }
  }

  console.log(`\n═══ build summary · ${city.id} ═══`);
  for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"} ${r.name.padEnd(14)} ${r.secs.toFixed(0)}s`);
  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length
      ? `\n⚠ ${failed.length} step(s) failed: ${failed.map((r) => r.name).join(", ")}. Re-run individually, then:`
      : `\n✓ all steps ran. Next:`,
  );
  console.log(`   npm run city:qa -- --city ${city.id}`);
  console.log(`   then flip the city's status to "live" in lib/cities.ts.\n`);
  if (failed.length) process.exitCode = 1;
}

main();

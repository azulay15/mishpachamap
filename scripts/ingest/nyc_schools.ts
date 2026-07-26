/**
 * NYC POC — schools from the DOE school-locations directory (wg9x-4ke6) joined
 * to NY State test proficiency (Math 74kb-55u9 + ELA iebs-5yhr) by DBN.
 *
 * `pct_level_3_and_4` (% of students at proficiency Level 3–4) is the quality
 * signal — NYC's analog to Israel's Meitzav, but more interpretable: it's
 * already a 0–100 percentage. We average the latest year's Math + ELA.
 *
 * Output matches the app's StaticSchool shape so the schools panel + map layer
 * render unchanged (meitzav_score carries the proficiency %, meitzav_year the
 * test year — the UI labels it per-country).
 *
 * No API key needed.  Usage:  npx tsx scripts/ingest/nyc_schools.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";

const LOCATIONS = "https://data.cityofnewyork.us/resource/wg9x-4ke6.json";
const MATH = "https://data.cityofnewyork.us/resource/74kb-55u9.json";
const ELA = "https://data.cityofnewyork.us/resource/iebs-5yhr.json";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function soda(url: string, params: Record<string, string>): Promise<any[]> {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, { headers: { Accept: "application/json", "User-Agent": "MishpachaMap/0.1" } });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as any[];
}

/**
 * Latest-year school-level proficiency % per DBN. The Math and ELA datasets use
 * DIFFERENT field names for the same concepts, so the caller supplies a schema:
 *   Math: geographic_division / student_category / pct_level_3_and_4
 *   ELA:  geographic_subdivision / category      / level_3_4_1
 */
type TestSchema = { dbnField: string; catField: string; pctField: string };

async function proficiency(url: string, label: string, sc: TestSchema): Promise<Map<string, { pct: number; year: number }>> {
  const rows = await soda(url, {
    $select: `${sc.dbnField},year,${sc.pctField},number_tested,grade,${sc.catField}`,
    $where: `report_category='School' and ${sc.catField}='All Students' and ${sc.pctField} IS NOT NULL`,
    $limit: "600000",
  });
  console.log(`  ${label}: ${rows.length} school-level rows`);
  // keep the latest year per DBN, averaging its grades (weighted by tested)
  const latestYear = new Map<string, number>();
  for (const r of rows) {
    const dbn = String(r[sc.dbnField] ?? "").trim();
    const y = Number(r.year);
    if (!dbn || !Number.isFinite(y)) continue;
    if ((latestYear.get(dbn) ?? 0) < y) latestYear.set(dbn, y);
  }
  const acc = new Map<string, { sw: number; swv: number; year: number }>();
  for (const r of rows) {
    const dbn = String(r[sc.dbnField] ?? "").trim();
    const y = Number(r.year);
    const pct = Number(r[sc.pctField]);
    const n = Number(r.number_tested) || 1;
    if (!dbn || y !== latestYear.get(dbn) || !Number.isFinite(pct)) continue;
    const a = acc.get(dbn) ?? { sw: 0, swv: 0, year: y };
    a.sw += n; a.swv += pct * n;
    acc.set(dbn, a);
  }
  const out = new Map<string, { pct: number; year: number }>();
  for (const [dbn, a] of acc) if (a.sw > 0) out.set(dbn, { pct: a.swv / a.sw, year: a.year });
  return out;
}

/** Grade span → the app's level vocabulary. */
function levelFromGrades(txt: string): { level: string; from: number | null; to: number | null } {
  const t = (txt ?? "").toUpperCase();
  const nums = [...t.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const from = /PK|0K|KINDER/.test(t) ? 0 : nums.length ? Math.min(...nums) : null;
  const to = nums.length ? Math.max(...nums) : null;
  let level = "other";
  if (to != null && to <= 5) level = "elementary";
  else if (from != null && from >= 6 && to != null && to <= 8) level = "middle";
  else if (from != null && from >= 9) level = "high";
  else if (from != null && to != null && from <= 5 && to >= 6) level = "elementary-middle";
  return { level, from, to };
}

async function main() {
  const geoPath = resolve(process.cwd(), "public", "neighborhoods.nyc.geo.json");
  if (!existsSync(geoPath)) throw new Error("run nyc_geo.ts first");
  const geo = JSON.parse(readFileSync(geoPath, "utf8")) as { features: Array<{ geometry: any }> };
  const bbox = turf.bbox(turf.featureCollection(geo.features.map((f) => turf.feature(f.geometry)) as never));
  const M = 0.004;

  console.log("→ fetching NY State test proficiency (Math + ELA)…");
  const [math, ela] = await Promise.all([
    proficiency(MATH, "math", { dbnField: "geographic_division", catField: "student_category", pctField: "pct_level_3_and_4" }),
    proficiency(ELA, "ela", { dbnField: "geographic_subdivision", catField: "category", pctField: "level_3_4_1" }),
  ]);

  console.log("→ fetching DOE school locations (wg9x-4ke6)…");
  const locs = await soda(LOCATIONS, { $select: "system_code,location_name,grades_final_text,latitude,longitude,managed_by_name,location_type_description", $limit: "5000" });
  console.log(`  ${locs.length} school locations citywide`);

  const schools = locs
    .map((l) => {
      const lat = Number(l.latitude), lon = Number(l.longitude);
      const dbn = String(l.system_code ?? "").trim();
      const g = levelFromGrades(l.grades_final_text ?? "");
      const m = math.get(dbn), e = ela.get(dbn);
      const parts = [m?.pct, e?.pct].filter((x): x is number => x != null);
      const pct = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
      return {
        semel: dbn as unknown as number, // app keys schools by `semel`; DBN is NYC's id
        name_he: String(l.location_name ?? "").trim(), // display name (English in the POC)
        level: g.level,
        grade_from: g.from,
        grade_to: g.to,
        sector: null,
        supervision: l.managed_by_name ?? null, // "DOE" / "Charter" — shown as the type line
        students: null,
        offers_bagrut: g.level === "high",
        lon: Number.isFinite(lon) ? lon : null,
        lat: Number.isFinite(lat) ? lat : null,
        meitzav_score: pct, // % proficient (Level 3–4) — NYC's quality signal
        meitzav_year: m?.year ?? e?.year ?? null,
      };
    })
    .filter((s) => s.lat != null && s.lon != null)
    .filter((s) => s.lon! >= bbox[0] - M && s.lon! <= bbox[2] + M && s.lat! >= bbox[1] - M && s.lat! <= bbox[3] + M);

  writeFileSync(
    resolve(process.cwd(), "public", "nyc.schools.json"),
    JSON.stringify({ meta: { source: "NYC DOE School Locations (wg9x-4ke6) + NYS Math/ELA proficiency (74kb-55u9, iebs-5yhr)", note: "meitzav_score carries % proficient (Level 3-4)" }, schools }, null, 2) + "\n",
    "utf8",
  );
  const withScore = schools.filter((s) => s.meitzav_score != null).length;
  console.log(`✓ wrote public/nyc.schools.json — ${schools.length} schools in the POC area, ${withScore} with proficiency scores`);
  for (const s of schools.slice(0, 6)) console.log(`  ${String(s.semel).padEnd(8)} ${s.name_he.slice(0, 40).padEnd(41)} ${s.level.padEnd(12)} ${s.meitzav_score != null ? s.meitzav_score + "% proficient" : "—"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

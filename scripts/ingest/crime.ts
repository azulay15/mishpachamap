/**
 * Per-neighborhood safety signal from the Israel Police crime dataset
 * (data.gov.il `crime_records_data`, resource 5fc13c50, YeshuvKod=1200, 2024).
 *
 * ⚠️ This source is messier than the CBS census — verified before trusting:
 *   1. Its `StatisticAreaKod` uses an OLDER police statistical-area scheme
 *      (12000011…12000043, ~18 areas), NOT the CBS 2022 codes (111–335) our
 *      polygons use — so we can't join by code. BUT each area carries a
 *      neighborhood NAME (ספדיה/בוכמן/מירומי/קייזר/שמשוני/רעות/מכבים) matching
 *      our aliases, so we join via a hand-built code→neighborhood crosswalk.
 *   2. Many rows have UTF-8 corruption in the Hebrew string fields, so we key
 *      off the clean numeric `StatisticAreaKod` / `StatisticGroupKod`, never the
 *      corrupted name strings.
 *   3. The old scheme omits newer neighborhoods (Nofim, HaKramim, Masuah,
 *      Moreshet) → those are honestly null. The commercial "tech park" area is
 *      excluded from residential safety.
 *
 * Counts are 2024 REPORTED cases, normalized per 1,000 residents using the
 * census population from neighborhoods.demographics.json. This measures
 * reported crime density, not fear — caveat surfaced in the output.
 *
 * Output: public/neighborhoods.crime.json (static file, no DB migration).
 * Usage:  npm run ingest:crime   (run ingest:demographics first for population)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CKAN =
  "https://data.gov.il/api/3/action/datastore_search" +
  "?resource_id=5fc13c50-b6f3-4712-b831-a75e0f91a17e&limit=3000" +
  '&filters={"YeshuvKod":"1200"}';

/**
 * Police statistical-area code → our neighborhood id, matched by the area's
 * (clean) Hebrew name against our known aliases. Directional sub-areas
 * (north/south/center) fold into the parent neighborhood; "center" of a
 * split neighborhood is a judgment call flagged for review. 12000032 (tech
 * park) is intentionally excluded — commercial, not residential.
 */
const AREA_TO_NEIGHBORHOOD: Record<number, string | null> = {
  12000011: "hanechalim", // ספדיה (צפון)
  12000012: "hanechalim", // ספדיה (דרום)
  12000015: "hanechalim", // ספדיה (מערב)
  12000016: "haprachim", //  מירומי (מרכז)
  12000017: "haprachim", //  מירומי (מזרח)
  12000021: "hatsiporim", // ציפור
  12000022: "hanevim", //    השמשוני (צפון) → Shimshoni North
  12000023: "hameginim", //  השמשוני (מרכז) → center (review)
  12000026: "hameginim", //  השמשוני (דרום) → Shimshoni South
  12000024: "avneichen", //  קייזר (צפון)
  12000025: "avneichen", //  קייזר (דרום)
  12000031: "avneichen", //  קייזר (דרום) — second code (review)
  12000013: "hashvatim", //  בוכמן (צפון) → Buchman North
  12000033: "hashvatim", //  בוכמן (מרכז) → center (review)
  12000034: "moriah", //     בוכמן (דרום) → Buchman South
  12000041: "hareut", //     רעות (דרום)
  12000042: "hareut", //     רעות (צפון)
  12000043: "hamakkabim", // מכבים
  12000032: null, //         הפארק הטכנולוגי — commercial, excluded
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True if a Hebrew string looks intact (no replacement chars). */
function clean(s: unknown): s is string {
  return typeof s === "string" && !s.includes("�");
}

type Row = Record<string, unknown>;

async function main() {
  console.log("→ fetching Police crime records (YeshuvKod=1200, 2024)…");
  const res = await fetch(CKAN, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`CKAN: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { success: boolean; result?: { records: Row[] } };
  if (!json.success || !json.result) throw new Error("CKAN success=false");
  const rows = json.result.records;
  console.log(`  ${rows.length} case rows`);

  // Canonical offense-group name per (clean) StatisticGroupKod → classify.
  const groupName = new Map<number, string>();
  for (const r of rows) {
    const k = num(r.StatisticGroupKod);
    if (k != null && clean(r.StatisticGroup) && !groupName.has(k)) groupName.set(k, r.StatisticGroup as string);
  }
  const isPerson = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && (n.includes("גוף") || n.includes("מין") || n.includes("נגד אדם"));
  };
  const isProperty = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && n.includes("רכוש");
  };

  // Aggregate case counts per neighborhood via the crosswalk.
  type Agg = { total: number; person: number; property: number; areas: Set<number> };
  const agg = new Map<string, Agg>();
  let unmapped = 0;
  for (const r of rows) {
    const code = num(r.StatisticAreaKod);
    if (code == null) continue; // 367 city-wide/unassigned rows — not attributable
    const nb = AREA_TO_NEIGHBORHOOD[code];
    if (nb === undefined) { unmapped++; continue; }
    if (nb === null) continue; // deliberately excluded (tech park)
    const a = agg.get(nb) ?? { total: 0, person: 0, property: 0, areas: new Set() };
    a.total += 1;
    const gk = num(r.StatisticGroupKod);
    if (isPerson(gk)) a.person += 1;
    else if (isProperty(gk)) a.property += 1;
    a.areas.add(code);
    agg.set(nb, a);
  }
  if (unmapped) console.warn(`  ⚠ ${unmapped} rows had an unrecognized area code (skipped)`);

  // Population for per-capita normalization.
  const demo = JSON.parse(
    readFileSync(resolve(process.cwd(), "public", "neighborhoods.demographics.json"), "utf8"),
  ) as { neighborhoods: Record<string, { population?: number } | null> };

  const geo = JSON.parse(
    readFileSync(resolve(process.cwd(), "public", "neighborhoods.geo.json"), "utf8"),
  ) as { features: Array<{ properties: { id: string; name_he: string } }> };

  // Per-1000 rate, plus a rank (1 = safest of the covered set).
  const rate = new Map<string, number>();
  for (const [nb, a] of agg) {
    const pop = demo.neighborhoods[nb]?.population ?? null;
    if (pop && pop > 0) rate.set(nb, (a.total / pop) * 1000);
  }
  const ordered = [...rate.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  const rankOf = (nb: string) => ordered.indexOf(nb) + 1;
  // safety_score: ABSOLUTE (not a relative percentile), so a safe city stays in
  // the safe band. ~4/1000 → ~94, ~15/1000 → ~76, ~33/1000 → ~47. Clamped 40–98
  // so no neighborhood reads as "0/dangerous"; it's still clearly differentiating.
  const scoreOf = (per1000: number) => Math.round(Math.min(98, Math.max(40, 100 - per1000 * 1.6)));

  const out: Record<string, unknown> = {};
  for (const f of geo.features) {
    const id = f.properties.id;
    const a = agg.get(id);
    if (!a) { out[id] = null; continue; }
    const per1000 = rate.get(id) ?? null;
    out[id] = {
      name_he: f.properties.name_he,
      cases_2024_total: a.total,
      cases_2024_person: a.person,
      cases_2024_property: a.property,
      per_1000_residents: per1000 != null ? Math.round(per1000 * 10) / 10 : null,
      safety_score: per1000 != null ? scoreOf(per1000) : null,
      safety_rank: per1000 != null ? rankOf(id) : null,
      safety_rank_of: ordered.length,
      source: {
        provider: "Israel Police crime_records_data (data.gov.il 5fc13c50)",
        period: "2024 (Q1–Q4)",
        note: "reported cases; residential safety approx; commercial areas excluded; name-matched to older police area scheme",
        police_areas: [...a.areas].sort(),
      },
    };
  }

  const path = resolve(process.cwd(), "public", "neighborhoods.crime.json");
  writeFileSync(
    path,
    JSON.stringify({ meta: { source: "Israel Police 2024", resource: "5fc13c50-b6f3-4712-b831-a75e0f91a17e", locality: 1200 }, neighborhoods: out }, null, 2) + "\n",
    "utf8",
  );

  // Report — ordered safest → least, for the local-expert sanity check.
  console.log("\nneighborhood     cases  /1000  safety   police-areas");
  const covered = Object.entries(out).filter(([, v]) => v) as [string, { cases_2024_total: number; per_1000_residents: number; safety_score: number; source: { police_areas: number[] } }][];
  covered.sort((a, b) => b[1].safety_score - a[1].safety_score);
  for (const [id, v] of covered) {
    console.log(`  ${id.padEnd(13)} ${String(v.cases_2024_total).padStart(4)}  ${String(v.per_1000_residents).padStart(5)}  ${String(v.safety_score).padStart(3)}     ${v.source.police_areas.join(",")}`);
  }
  const nulls = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n○ no crime-area coverage (honest null): ${nulls.join(", ")}`);
  console.log(`→ wrote public/neighborhoods.crime.json — ${covered.length}/${geo.features.length} covered`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

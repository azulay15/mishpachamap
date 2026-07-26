/**
 * Per-neighborhood safety signal from the Israel Police crime dataset
 * (data.gov.il `crime_records_data`, resource 5fc13c50, per city, 2024).
 *
 * The police use their OWN older statistical-area scheme (e.g. 24000010,
 * 83000311) with a Hebrew area NAME, NOT the CBS 2022 codes our polygons use.
 * We map each police area to a neighborhood two ways:
 *   1. AUTO-MATCH by name — most areas carry the neighborhood name (נווה סביון,
 *      קריית גיורא, רמב"ם, רמז…), so a normalized name match finds the right
 *      neighborhood. This scales to any city whose police names match ours.
 *   2. OVERRIDE map (CROSSWALKS) — for areas whose name doesn't match (old
 *      aliases like Modi'in's ספדיה/בוכמן/קייזר, or ambiguous ones like
 *      "מרכז העיר" / "עמידר" / "היקב"). An override to null excludes an area.
 * Industrial/commercial areas (אזור תעשייה / מב"ת) and the city-wide bucket
 * (code 0 / no name) are excluded from residential safety.
 *
 * Counts are 2024 REPORTED cases, normalized per 1,000 residents from the
 * city's demographics file. Reported-crime density, not fear.
 *
 * Output: public/<city>.crime.json (static, no DB migration).
 * Usage:  npx tsx scripts/ingest/crime.ts --city oryehuda
 *         (run demographics for that city first, for population)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CITIES } from "./cities";

/**
 * Per-city police-area → neighborhood overrides. Only areas that DON'T
 * name-match (or need a judgment call) go here; the rest auto-match. `null`
 * excludes an area from residential safety.
 */
const CROSSWALKS: Record<string, Record<number, string | null>> = {
  // Modi'in's police area names are OLD aliases that don't match the current
  // neighborhood names, so its whole crosswalk is explicit (name-matched by hand).
  modiin: {
    12000011: "hanechalim", 12000012: "hanechalim", 12000015: "hanechalim",
    12000016: "haprachim", 12000017: "haprachim",
    12000021: "hatsiporim",
    12000022: "hanevim", 12000023: "hameginim", 12000026: "hameginim",
    12000024: "avneichen", 12000025: "avneichen", 12000031: "avneichen",
    12000013: "hashvatim", 12000033: "hashvatim", 12000034: "moriah",
    12000041: "hareut", 12000042: "hareut", 12000043: "hamakkabim",
    12000032: null, // הפארק הטכנולוגי — commercial
  },
  // Or Yehuda: neve-savyon / neve-rabin / kiryat-giora auto-match; these are the
  // judgment calls (veteran-housing + civic areas → their nearest neighborhood).
  oryehuda: {
    24000012: "kiryat-giora", // שיכון ממשלתי (veteran housing, east-center)
    24000007: null, // מרכז העיר — commercial civic center (crime ≠ residential pop)
    24000008: "kiryat-giora", // עמידר (public housing)
    24000004: "shchunot-dromiyot", // ההסתדרות (צפון)
    24000005: "shchunot-dromiyot", // ההסתדרות (דרום)
  },
  // Rishon LeZion: ~50 areas auto-match; these are name-mismatches (spelling
  // variants) + genuine judgment calls (city-center, winery, נווה אליהו).
  rishon: {
    83000314: null, // מרכז העיר (1) — commercial center (crime ≠ residential pop)
    83000315: null, // מרכז העיר (2) — commercial center
    83000225: null, // היקב (Carmel winery / commercial, old center-east)
    83000114: "kidmat-rishon", // קידמת ראשון (spelling: קידמת vs קדמת)
    83000521: "kiryat-rishon", // קרית ראשון (מזרח)
    83000522: "kiryat-rishon", // קרית ראשון (מערב)
    83000514: "kiryat-rishon", // נווה אליהו (west cluster)
    83000523: "kiryat-kramim", // קרית כרמים (מזרח)
    83000524: "kiryat-kramim", // קרית כרמים (מערב)
    83000123: "rambam", // רובע רמב''ם (צפון) — double-quote variant
  },
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isClean = (s: unknown): s is string => typeof s === "string" && !s.includes("�") && !s.includes("�");
const cleanQ = (s: string) => s.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
/** Normalize a Hebrew area/neighborhood name to a core for matching. */
const core = (s: string) =>
  cleanQ(s)
    .replace(/\((צפון|דרום|מזרח|מערב|מרכז|צפון-מערב|דרום-מזרח|מרכז וצפון)\)/g, "")
    .replace(/[()]/g, "")
    .replace(/\b(רובע|שכונת|שיכון)\b/g, "")
    .replace(/\s+(צפון|דרום|מזרח|מערב|מרכז)\b/g, "")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/^ה/, "")
    .trim();
const isNonResidential = (name: string) => /תעשי|מסחר|לוגיסטי|מב"?ת|מב''ת/.test(name);

type Row = Record<string, unknown>;

async function main() {
  const cityArg = (() => {
    const i = process.argv.indexOf("--city");
    return i >= 0 ? process.argv[i + 1] : "modiin";
  })();
  const city = CITIES[cityArg];
  if (!city) {
    console.error(`Unknown city "${cityArg}". Known: ${Object.keys(CITIES).join(", ")}`);
    process.exit(1);
  }
  const override = CROSSWALKS[city.id] ?? {};
  const demoFile = city.demographicsOut ?? `${city.id}.demographics.json`;
  const outName = city.crimeOut ?? `${city.id}.crime.json`;

  const geo = JSON.parse(readFileSync(resolve(process.cwd(), city.outFile), "utf8")) as {
    features: Array<{ properties: { id: string; name_he: string } }>;
  };
  const nbs = geo.features.map((f) => ({ id: f.properties.id, coreName: core(f.properties.name_he) }));
  const autoMatch = (name: string): string | null => {
    const cn = core(name);
    if (!cn) return null;
    let best: string | null = null, len = 0;
    for (const nb of nbs) {
      if (nb.coreName.length < 3) continue;
      if ((cn.includes(nb.coreName) || nb.coreName.includes(cn)) && nb.coreName.length > len) {
        best = nb.id; len = nb.coreName.length;
      }
    }
    return best;
  };

  console.log(`→ fetching Police crime records for ${city.id} (YeshuvKod=${city.semelYishuv})…`);
  const url =
    "https://data.gov.il/api/3/action/datastore_search?resource_id=5fc13c50-b6f3-4712-b831-a75e0f91a17e&limit=40000&filters=" +
    encodeURIComponent(JSON.stringify({ YeshuvKod: String(city.semelYishuv) }));
  const res = await fetch(url, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`CKAN: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { success: boolean; result?: { records: Row[] } };
  if (!json.success || !json.result) throw new Error("CKAN success=false");
  const rows = json.result.records;
  console.log(`  ${rows.length} case rows`);

  // Offense-group classification (person vs property).
  const groupName = new Map<number, string>();
  for (const r of rows) {
    const k = num(r.StatisticGroupKod);
    if (k != null && isClean(r.StatisticGroup) && !groupName.has(k)) groupName.set(k, r.StatisticGroup as string);
  }
  const isPerson = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && (n.includes("גוף") || n.includes("מין") || n.includes("נגד אדם"));
  };
  const isProperty = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && n.includes("רכוש");
  };

  // First clean name per area code (for auto-match + reporting).
  const areaName = new Map<number, string>();
  for (const r of rows) {
    const code = num(r.StatisticAreaKod);
    if (code != null && isClean(r.StatisticArea) && !areaName.has(code)) areaName.set(code, cleanQ(r.StatisticArea as string));
  }

  // Resolve each area code → neighborhood (override > industrial > auto-match).
  const areaToNb = new Map<number, string | null>();
  for (const code of areaName.keys()) {
    if (code in override) { areaToNb.set(code, override[code]); continue; }
    const name = areaName.get(code) ?? "";
    if (!code || isNonResidential(name)) { areaToNb.set(code, null); continue; }
    areaToNb.set(code, autoMatch(name));
  }

  type Agg = { total: number; person: number; property: number; areas: Set<number> };
  const agg = new Map<string, Agg>();
  const unmapped = new Set<number>();
  for (const r of rows) {
    const code = num(r.StatisticAreaKod);
    if (code == null || code === 0) continue; // city-wide / unassigned
    const nb = code in override ? override[code] : areaToNb.get(code);
    if (nb == null) { if (!(code in override) && !isNonResidential(areaName.get(code) ?? "")) unmapped.add(code); continue; }
    const a = agg.get(nb) ?? { total: 0, person: 0, property: 0, areas: new Set() };
    a.total += 1;
    const gk = num(r.StatisticGroupKod);
    if (isPerson(gk)) a.person += 1;
    else if (isProperty(gk)) a.property += 1;
    a.areas.add(code);
    agg.set(nb, a);
  }
  if (unmapped.size) {
    console.warn(`  ⚠ ${unmapped.size} area codes didn't match a neighborhood (skipped):`);
    for (const c of unmapped) console.warn(`     ${c}  ${areaName.get(c) ?? ""}`);
  }

  const demo = JSON.parse(readFileSync(resolve(process.cwd(), "public", demoFile), "utf8")) as {
    neighborhoods: Record<string, { population?: number } | null>;
  };

  // A reported-crime rate this high (per 1,000 residents) is implausible for a
  // residential neighborhood and signals a denominator mismatch — the police
  // area covers materially more people than the CBS neighborhood's census pop.
  // We suppress those (honest "no data") rather than publish a misleading floor.
  const MAX_PLAUSIBLE_RATE = 70;
  const rate = new Map<string, number>();
  const suppressed: Array<[string, number]> = [];
  for (const [nb, a] of agg) {
    const pop = demo.neighborhoods[nb]?.population ?? null;
    if (!pop || pop <= 0) continue;
    const per1000 = (a.total / pop) * 1000;
    if (per1000 > MAX_PLAUSIBLE_RATE) { suppressed.push([nb, per1000]); continue; }
    rate.set(nb, per1000);
  }
  if (suppressed.length) {
    console.warn(`  ⚠ suppressed ${suppressed.length} (rate > ${MAX_PLAUSIBLE_RATE}/1000 — police area ≠ census pop): ${suppressed.map(([n, r]) => `${n}(${r.toFixed(0)})`).join(", ")}`);
  }
  const ordered = [...rate.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  const rankOf = (nb: string) => ordered.indexOf(nb) + 1;
  // Absolute (not percentile) so a safe city stays safe. ~4/1000→~94, ~33/1000→~47.
  const scoreOf = (per1000: number) => Math.round(Math.min(98, Math.max(40, 100 - per1000 * 1.6)));

  const out: Record<string, unknown> = {};
  for (const f of geo.features) {
    const id = f.properties.id;
    const a = agg.get(id);
    const per1000 = a ? rate.get(id) ?? null : null;
    if (!a || per1000 == null) { out[id] = null; continue; } // no coverage or suppressed (implausible)
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
        period: "2024",
        note: "reported cases; residential safety approx; commercial areas excluded; name-matched to the police area scheme",
        police_areas: [...a.areas].sort(),
      },
    };
  }

  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify({ meta: { source: "Israel Police 2024", resource: "5fc13c50-b6f3-4712-b831-a75e0f91a17e", locality: city.semelYishuv }, neighborhoods: out }, null, 2) + "\n",
    "utf8",
  );

  console.log("\nneighborhood            cases  /1000  safety   police-areas");
  const covered = Object.entries(out).filter(([, v]) => v) as [string, { cases_2024_total: number; per_1000_residents: number; safety_score: number; source: { police_areas: number[] } }][];
  covered.sort((a, b) => b[1].safety_score - a[1].safety_score);
  for (const [id, v] of covered) {
    console.log(`  ${id.padEnd(22)} ${String(v.cases_2024_total).padStart(4)}  ${String(v.per_1000_residents).padStart(5)}  ${String(v.safety_score).padStart(3)}     ${v.source.police_areas.join(",")}`);
  }
  const nulls = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n○ no crime-area coverage (honest null): ${nulls.join(", ") || "(none)"}`);
  console.log(`→ wrote public/${outName} — ${covered.length}/${geo.features.length} covered`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

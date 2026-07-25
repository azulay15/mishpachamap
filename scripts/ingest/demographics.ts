/**
 * Build per-neighborhood demographics from the CBS 2022 Census
 * "selected data by statistical area" — REAL data that joins directly to our
 * neighborhoods, because our neighborhoods ARE CBS 2022 statistical areas.
 *
 * Source: data.gov.il CKAN, dataset "2022", resource
 *   9a9e085f-3bc8-41df-b15f-be0daaf99e30, filtered to LocalityCode=1200
 *   (Modi'in-Maccabim-Re'ut) → 25 statistical-area rows.
 *
 * Join: each neighborhood in public/neighborhoods.geo.json carries a
 *   `stat_areas` list (written by build_neighborhoods.ts). We gather the census
 *   rows for those areas and POPULATION-WEIGHT-AGGREGATE them (25 areas → 14
 *   neighborhoods). Areas the census suppresses/omits (too small, or brand-new
 *   like Moreshet's 335) simply don't contribute; a neighborhood with zero
 *   covered areas is written as null (honest — no fabrication).
 *
 * Output: public/neighborhoods.demographics.json — a static file the app can
 *   join server-side (same pattern as the GeoJSON), so this needs no DB
 *   migration. Each entry records which areas it used + which were missing.
 *
 * Usage:  npm run ingest:demographics
 * No Supabase credentials needed — reads open data + a local file, writes a file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CKAN =
  "https://data.gov.il/api/3/action/datastore_search" +
  "?resource_id=9a9e085f-3bc8-41df-b15f-be0daaf99e30&limit=100" +
  '&filters={"LocalityCode":"1200"}';

/** Census values arrive as a mix of numbers and numeric strings ("10.7"). */
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type CensusRow = Record<string, unknown> & { StatArea?: string | number; pop_approx?: number };

/** Population-weighted mean of a field across the rows that have it. */
function wmean(rows: CensusRow[], field: string): number | null {
  let sw = 0;
  let swv = 0;
  for (const r of rows) {
    const w = num(r.pop_approx);
    const v = num(r[field]);
    if (w == null || w <= 0 || v == null) continue;
    sw += w;
    swv += v * w;
  }
  return sw > 0 ? swv / sw : null;
}

/** Round to `d` decimals (null-safe). */
function rnd(v: number | null, d = 1): number | null {
  if (v == null) return null;
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

async function main() {
  console.log("→ fetching CBS 2022 census (LocalityCode=1200)…");
  const res = await fetch(CKAN, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`CKAN: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { success: boolean; result?: { records: CensusRow[] } };
  if (!json.success || !json.result) throw new Error("CKAN returned success=false");

  // Key census rows by StatArea code (skip the empty city-aggregate row).
  const byArea = new Map<number, CensusRow>();
  for (const r of json.result.records) {
    const code = num(r.StatArea);
    if (code != null) byArea.set(code, r);
  }
  console.log(`  ${byArea.size} statistical-area rows`);

  const geo = JSON.parse(
    readFileSync(resolve(process.cwd(), "public", "neighborhoods.geo.json"), "utf8"),
  ) as { features: Array<{ properties: { id: string; name_he: string; stat_areas?: number[] } }> };

  const out: Record<string, unknown> = {};
  for (const f of geo.features) {
    const { id, name_he } = f.properties;
    const wanted = f.properties.stat_areas ?? [];
    const used = wanted.filter((c) => byArea.has(c));
    const missing = wanted.filter((c) => !byArea.has(c));
    const rows = used.map((c) => byArea.get(c)!);

    if (rows.length === 0) {
      out[id] = null; // honest: no census coverage (e.g. brand-new Moreshet)
      console.log(`  ○ ${id.padEnd(12)} no census coverage (areas ${wanted.join(",")} all suppressed/new)`);
      continue;
    }

    const pop = rows.reduce((s, r) => s + (num(r.pop_approx) ?? 0), 0);
    const households = rows.reduce((s, r) => s + (num(r.hh_total_approx) ?? 0), 0);

    // Religiosity: population-weighted dominant category.
    const relWeight = new Map<string, number>();
    for (const r of rows) {
      const label = typeof r.hh_MidatDatiyut === "string" ? r.hh_MidatDatiyut : null;
      const w = num(r.pop_approx) ?? 0;
      if (label && w > 0) relWeight.set(label, (relWeight.get(label) ?? 0) + w);
    }
    const religiosity =
      [...relWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    out[id] = {
      name_he,
      population: Math.round(pop),
      households: Math.round(households),
      household_size: rnd(wmean(rows, "size_avg"), 2),
      median_age: rnd(wmean(rows, "age_median"), 0),
      pct_age_0_19: rnd(wmean(rows, "age0_19_pcnt")),
      pct_age_65_plus: rnd(wmean(rows, "age65_pcnt")),
      pct_households_with_kids_0_5: rnd(wmean(rows, "hh0_5_pcnt")),
      avg_children_born: rnd(wmean(rows, "ChldBorn_avg"), 2),
      pct_academic: rnd(wmean(rows, "AcadmCert_pcnt")),
      // CBS reports ANNUAL gross wage; Israelis think in MONTHLY, so ÷12 and
      // round to the nearest ₪100.
      median_wage_monthly: (() => {
        const annual = wmean(rows, "employeesAnnual_medWage");
        return annual == null ? null : Math.round(annual / 12 / 100) * 100;
      })(),
      pct_own: rnd(wmean(rows, "own_pcnt")),
      pct_rent: rnd(wmean(rows, "rent_pcnt")),
      religiosity,
      source: {
        provider: "CBS Census 2022 (data.gov.il 9a9e085f)",
        as_of: "2022",
        stat_areas_used: used,
        stat_areas_missing: missing,
      },
    };
    const cov = missing.length ? ` (missing ${missing.join(",")})` : "";
    console.log(
      `  ✓ ${id.padEnd(12)} pop ${Math.round(pop)} · size ${rnd(wmean(rows, "size_avg"), 1)} · kids0-5 ${rnd(wmean(rows, "hh0_5_pcnt"))}% · ${religiosity} · ₪${Math.round((wmean(rows, "employeesAnnual_medWage") ?? 0) / 12).toLocaleString()}/mo${cov}`,
    );
  }

  const path = resolve(process.cwd(), "public", "neighborhoods.demographics.json");
  writeFileSync(
    path,
    JSON.stringify(
      { meta: { source: "CBS Census 2022 by statistical area", resource: "9a9e085f-3bc8-41df-b15f-be0daaf99e30", locality: 1200, generated_from: "public/neighborhoods.geo.json stat_areas" }, neighborhoods: out },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  const covered = Object.values(out).filter(Boolean).length;
  console.log(`\n→ wrote public/neighborhoods.demographics.json — ${covered}/${geo.features.length} neighborhoods with real census data`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Rebuild the schools table from AUTHORITATIVE Ministry of Education data,
 * replacing the OSM-derived list that was 70% wrong (24/34 schools were outside
 * Modi'in, 23 stuck on one bad-geocode point ~11km away).
 *
 * Sources (data.gov.il):
 *   - mosdot (5548fd63…): the roster — semel, name, grades, sector, supervision,
 *     students, bagrut. Filter `שם ישוב` = "מודיעין-מכבים-" (the value is
 *     truncated in the dataset), EXCLUDING "מודיעין עילית" (a different city).
 *   - coordinates (5c5d6bb0…): exact location per semel. NOTE the `UTM_X`/`UTM_Y`
 *     columns are mislabeled — their values are plain WGS84 lon/lat.
 *   - rama_meitzav "הישגים בית ספרי" (b81f0760…): achievement scores per
 *     semel/year/grade/subject (~500 scale). Stale (2008–2020) but real; we take
 *     each school's most recent year and average across subjects/grades.
 *
 * Writes BOTH:
 *   - the DB `schools` table (existing columns: id, name_he, point, level,
 *     meitzav_score, rating_year) so the schools_within_meters RPC + school_score
 *     become correct (re-run `npm run metrics:recompute` after);
 *   - public/schools.modiin.json with the full metadata (sector/grades/bagrut/
 *     students), ready for the "schools within walking distance" panel once
 *     migration 0003_school_metadata.sql adds those columns.
 *
 * Usage:  npm run ingest:schools:moe
 */
import { sb, wktPoint } from "./_env";
import { CITIES } from "./cities";

const MOSDOT = "5548fd63-5868-4053-ad81-98caddc5e232";
const COORDS = "5c5d6bb0-755d-470d-84b6-d7dd3135ba9c";
const MEITZAV = "b81f0760-2562-4a27-9db7-699542d071a0";

type Rec = Record<string, unknown>;

async function ckan(resource: string, params: Record<string, string>): Promise<Rec[]> {
  const qs = new URLSearchParams({ resource_id: resource, ...params });
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?${qs}`, {
    headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CKAN ${resource}: ${res.status}`);
  const j = (await res.json()) as { success: boolean; result?: { records: Rec[] } };
  if (!j.success || !j.result) throw new Error(`CKAN ${resource}: success=false`);
  return j.result.records;
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Undo the CSV double-quote escaping that mangles some Hebrew fields
 *  (e.g. `"מ""מ"` → `מ"מ`, `"ת""ת מכתב מאליהו"` → `ת"ת מכתב מאליהו`). */
const cleanHe = (v: unknown): string =>
  String(v ?? "").replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();

/** Hebrew/English level from the grade span (משכבה..עד שכבה). */
function levelFromGrades(from: number | null, to: number | null): string {
  if (to != null && to <= 6) return "elementary";
  if (from != null && from >= 7 && (to == null || to <= 9)) return "middle";
  if (from != null && from >= 10) return "high";
  if (from != null && to != null && from <= 6 && to >= 7) return "elementary-middle";
  return "other";
}

async function coordOf(semel: number): Promise<{ lon: number; lat: number; acc: string | null } | null> {
  const recs = await ckan(COORDS, { limit: "2", filters: JSON.stringify({ SEMEL_MOSAD: String(semel) }) });
  const r = recs[0];
  if (!r) return null;
  const lon = num(r.UTM_X); // mislabeled — actually WGS84 lon
  const lat = num(r.UTM_Y); // mislabeled — actually WGS84 lat
  if (lon == null || lat == null) return null;
  return { lon, lat, acc: (r.RAMAT_DIYUK_MIKUM as string) ?? null };
}

async function meitzavOf(semel: number): Promise<{ score: number; year: number } | null> {
  const recs = await ckan(MEITZAV, { limit: "500", filters: JSON.stringify({ semel_mosad: String(semel) }) });
  if (recs.length === 0) return null;
  const latest = Math.max(...recs.map((r) => num(r.year) ?? 0));
  const scores = recs.filter((r) => num(r.year) === latest).map((r) => num(r.score)).filter((n): n is number => n != null);
  if (scores.length === 0) return null;
  return { score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), year: latest };
}

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
  const CITY = city.moeCityName ?? city.id; // MoE "שם ישוב" filter value
  const outName = city.schoolsOut ?? `${city.id}.schools.json`;
  const writeDb = process.argv.includes("--db");

  console.log(`→ fetching MoE roster (mosdot) for ${city.id} ("${CITY}")…`);
  const all = await ckan(MOSDOT, { limit: "1000", filters: JSON.stringify({ "שם ישוב": CITY }) });
  // Latest year per semel; keep schools (grade-bearing), drop kindergartens.
  const latestBySemel = new Map<number, Rec>();
  for (const r of all) {
    const semel = num(r["סמל מוסד"]);
    if (semel == null) continue;
    const y = num(r["שנה"]) ?? 0;
    const prev = latestBySemel.get(semel);
    if (!prev || (num(prev["שנה"]) ?? 0) < y) latestBySemel.set(semel, r);
  }
  const schools = [...latestBySemel.values()].filter((r) => {
    const t = String(r["סוג מוסד"] ?? "");
    const from = num(r["משכבה"]);
    return !t.includes("גן") && from != null; // has grades → a school, not a gan
  });
  console.log(`  ${schools.length} ${city.id} schools (from ${latestBySemel.size} institutions)`);

  const rows: Array<{ id: string; name_he: string; point: string; level: string; meitzav_score: number | null; rating_year: number | null }> = [];
  const full: Rec[] = [];
  let geocoded = 0;
  let withMeitzav = 0;
  for (const s of schools) {
    const semel = num(s["סמל מוסד"])!;
    const name = cleanHe(s["שם מוסד"]);
    const from = num(s["משכבה"]);
    const to = num(s["עד שכבה"]);
    const level = levelFromGrades(from, to);
    const coord = await coordOf(semel);
    const mz = await meitzavOf(semel);
    if (coord) geocoded++;
    if (mz) withMeitzav++;
    if (coord) {
      rows.push({
        id: `moe-${semel}`,
        name_he: name,
        point: wktPoint([coord.lon, coord.lat]),
        level,
        meitzav_score: mz?.score ?? null,
        rating_year: mz?.year ?? null,
      });
    }
    full.push({
      semel,
      name_he: name,
      level,
      grade_from: from,
      grade_to: to,
      sector: cleanHe(s["מגזר"]) || null,
      supervision: cleanHe(s["פיקוח"]) || null,
      students: num(s["סהכ תלמידים במוסד"]),
      offers_bagrut: String(s["מגיש לבגרות"] ?? "").includes("כן") || s["מגיש לבגרות"] === 1,
      lon: coord?.lon ?? null,
      lat: coord?.lat ?? null,
      geocode_accuracy: coord?.acc ?? null,
      meitzav_score: mz?.score ?? null,
      meitzav_year: mz?.year ?? null,
    });
    console.log(`  ${coord ? "✓" : "○"} ${String(semel).padEnd(7)} ${name.slice(0, 26).padEnd(27)} ${level.padEnd(10)} ${mz ? "מיצ״ב " + mz.score + " (" + mz.year + ")" : "—"}${coord ? "" : "  NO COORDS"}`);
  }

  // Static file (full metadata, panel-ready).
  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify({ meta: { source: "MoE mosdot + coordinates + RAMA meitzav (data.gov.il)", locality: CITY, generated: "static; DB has id/name/point/level/meitzav" }, schools: full }, null, 2) + "\n",
    "utf8",
  );

  // Rebuild the DB schools table (DML only — no migration). GATED behind --db
  // because it wipes the WHOLE table: running it for a second city without the
  // flag would delete the first city's schools. The app reads the static file,
  // so the DB write is only needed for the compute_metrics school_score RPC.
  if (writeDb) {
    console.log(`\n→ replacing DB schools table with ${rows.length} correctly-located schools…`);
    const { error: delErr } = await sb.from("schools").delete().neq("id", "__none__");
    if (delErr) throw new Error(`delete: ${delErr.message}`);
    const { error: insErr } = await sb.from("schools").insert(rows);
    if (insErr) throw new Error(`insert: ${insErr.message}`);
    console.log(`✓ wrote ${rows.length} schools to DB`);
  }

  console.log(`✓ wrote public/${outName} (${full.length} schools, ${geocoded}/${schools.length} geocoded, ${withMeitzav} with meitzav)`);
  if (writeDb) console.log(`\nNext: npm run metrics:recompute   (updates school_score from the corrected schools)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

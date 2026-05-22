/**
 * Ingest Meitzav (מיצ"ב) standardized-test scores from data.gov.il into the
 * `schools` table.
 *
 * Two CKAN datastore resources, public, no auth required:
 *   #7 "נתוני רקע על בתי הספר" (RAMA_META) — school metadata: name, locality,
 *       semel_mosad (Ministry of Education ID), sector, socioeconomic class.
 *   #1 "היישגים בית ספרי" (RAMA_ACHIEVEMENTS) — score per
 *       (school, year, grade, subject). We aggregate to a single number per
 *       school (avg across subjects in the most recent year that the school
 *       was tested).
 *
 * Each Modi'in school is also Mapbox-geocoded so it can be placed on the map
 * + used by the existing `schools_within_meters()` neighborhood RPC.
 *
 * Usage:
 *   npm run ingest:meitzav -- [--city="מודיעין-מכבים-רעות"] [--min-relevance=0.4] [--dry-run]
 */
import "./_env";
import { sb } from "./_env";

const META_RESOURCE = "ff2364e2-bea7-4921-93a0-3eb924ecf36c";
const ACHIEVEMENTS_RESOURCE = "b81f0760-2562-4a27-9db7-699542d071a0";
const CKAN_BASE = "https://data.gov.il/api/3/action/datastore_search";

const MAPBOX_TOKEN =
  process.env.MAPBOX_SERVER_TOKEN ?? process.env.MAPBOX_TOKEN ?? "";

type MetaRow = {
  semel_mosad: number;
  shem_mosad: string;
  rashut_teur: string;
  migzar: string | null;
  ses_mosad_cat_yh: string | null;
};

type AchievementRow = {
  semel_mosad: number;
  year: number;
  shichva: number;
  subject_id: string;
  score: number;
};

type Args = {
  city: string;
  minRelevance: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let city = "מודיעין-מכבים-רעות";
  // Default is low — the city post-filter (resolved address must contain
  // "מודיעין" / "Modi'in") is the actual quality gate. Raise this if you see
  // Mapbox returning weird matches that happen to mention the city.
  let minRelevance = 0;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--city=")) city = a.slice("--city=".length);
    else if (a.startsWith("--min-relevance="))
      minRelevance = Number(a.slice("--min-relevance=".length));
    else if (a === "--dry-run") dryRun = true;
  }
  return { city, minRelevance, dryRun };
}

async function ckanFetch<T>(
  resourceId: string,
  filters: Record<string, string | number> | null,
  limit = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(CKAN_BASE);
    url.searchParams.set("resource_id", resourceId);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    if (filters) url.searchParams.set("filters", JSON.stringify(filters));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`CKAN ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as {
      success: boolean;
      result: { records: T[]; total: number };
    };
    if (!body.success) throw new Error(`CKAN unsuccessful: ${JSON.stringify(body)}`);
    out.push(...body.result.records);
    if (body.result.records.length < limit) break;
    offset += limit;
  }
  return out;
}

type GeocodeHit = {
  lat: number;
  lng: number;
  relevance: number;
  resolved_text: string;
};

async function geocode(query: string): Promise<GeocodeHit | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("country", "il");
  url.searchParams.set("language", "he");
  url.searchParams.set("limit", "1");
  url.searchParams.set("proximity", "35.01,31.9");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = (await res.json()) as {
    features?: { center: [number, number]; relevance: number; place_name: string }[];
  };
  const f = body.features?.[0];
  if (!f) return null;
  return {
    lng: f.center[0],
    lat: f.center[1],
    relevance: f.relevance,
    resolved_text: f.place_name,
  };
}

/** Aggregate raw achievement rows: one score per (semel_mosad, year, subject)
 *  → one score per school = avg across subjects in the most recent year that
 *  has any data for the school. */
function aggregateScores(
  rows: AchievementRow[],
): Map<number, { score: number; year: number; samples: number }> {
  // Bucket by school+year first. CKAN returns numeric columns as strings — coerce.
  const byYear = new Map<string, { sum: number; n: number; semel: number; year: number }>();
  for (const r of rows) {
    const score = Number(r.score);
    if (!Number.isFinite(score)) continue;
    const key = `${r.semel_mosad}|${r.year}`;
    const b = byYear.get(key) ?? { sum: 0, n: 0, semel: r.semel_mosad, year: r.year };
    b.sum += score;
    b.n += 1;
    byYear.set(key, b);
  }
  // Pick most recent year per school.
  const bySchool = new Map<number, { score: number; year: number; samples: number }>();
  for (const b of byYear.values()) {
    const existing = bySchool.get(b.semel);
    if (!existing || b.year > existing.year) {
      bySchool.set(b.semel, {
        score: Math.round(b.sum / b.n),
        year: b.year,
        samples: b.n,
      });
    }
  }
  return bySchool;
}

/** Infer level (יסודי / חט"ב / תיכון) from the school name + grade range. */
function inferLevel(name: string, grades: Set<number>): string | null {
  if (/יסודי|ביה"ס יסודי|ביס יסודי|ממ"ד|ממלכתי/.test(name) && grades.has(5)) return "elementary";
  if (/חט"ב|חטיבת בייניים|חט"ב/.test(name)) return "middle";
  if (/תיכון/.test(name)) return "high";
  if (grades.has(5) && !grades.has(8)) return "elementary";
  if (grades.has(8) && !grades.has(5)) return "middle";
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!MAPBOX_TOKEN) {
    console.error("missing MAPBOX_SERVER_TOKEN — geocoding required");
    process.exit(1);
  }

  console.log(`→ pulling school background data for "${args.city}"`);
  const meta = await ckanFetch<MetaRow>(META_RESOURCE, {
    rashut_teur: args.city,
  });
  console.log(`  ${meta.length} schools in metadata`);
  if (meta.length === 0) {
    console.warn(
      `no schools found — try a different --city value (the dataset uses official locality names).`,
    );
    process.exit(1);
  }

  console.log(`→ pulling achievement scores`);
  const semelSet = new Set(meta.map((m) => m.semel_mosad));
  // The achievements resource is large; pull all and filter client-side rather
  // than making one request per semel.
  const allAchievements = await ckanFetch<AchievementRow>(ACHIEVEMENTS_RESOURCE, null);
  const cityAchievements = allAchievements.filter((a) => semelSet.has(a.semel_mosad));
  console.log(
    `  ${allAchievements.length} total achievement rows; ${cityAchievements.length} for ${args.city}`,
  );

  const scoreByMosad = aggregateScores(cityAchievements);
  const gradesByMosad = new Map<number, Set<number>>();
  for (const a of cityAchievements) {
    if (!gradesByMosad.has(a.semel_mosad)) gradesByMosad.set(a.semel_mosad, new Set());
    gradesByMosad.get(a.semel_mosad)!.add(a.shichva);
  }
  console.log(`  ${scoreByMosad.size} schools have at least one score`);

  console.log(`→ geocoding + upserting`);
  let kept = 0;
  let dropped = 0;
  const upserts: Array<{
    id: string;
    name_he: string;
    point: string;
    level: string | null;
    meitzav_score: number | null;
    rating_year: number | null;
  }> = [];

  // Accept "מודיעין" or English transliterations as proof that the geocode
  // landed in the right city — Mapbox sometimes returns same-named schools
  // in totally different cities with high string-match relevance.
  const cityFragments = [args.city, "מודיעין", "Modiin", "Modi'in"];

  for (const m of meta) {
    const score = scoreByMosad.get(m.semel_mosad);
    // The official locality name "מודיעין-מכבים-רעות" trips Mapbox into
    // matching "מכבים, שוהם" (a different town nearby). Use the bare city
    // name + add the school-prefix word as a hint.
    const query = `בית ספר ${m.shem_mosad}, מודיעין`;
    const hit = await geocode(query);
    const inCity = hit && cityFragments.some((c) => hit.resolved_text.includes(c));
    if (!hit || hit.relevance < args.minRelevance || !inCity) {
      dropped++;
      if (dropped <= 8) {
        console.warn(
          `  skip ${m.semel_mosad} ${m.shem_mosad}: relevance ${(hit?.relevance ?? 0).toFixed(2)}${hit && !inCity ? ` (wrong city: ${hit.resolved_text})` : ""}`,
        );
      }
      continue;
    }
    const level = inferLevel(m.shem_mosad, gradesByMosad.get(m.semel_mosad) ?? new Set());
    upserts.push({
      id: `moe-${m.semel_mosad}`,
      name_he: m.shem_mosad,
      point: `SRID=4326;POINT(${hit.lng} ${hit.lat})`,
      level,
      meitzav_score: score?.score ?? null,
      rating_year: score?.year ?? null,
    });
    kept++;
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`✓ kept ${kept} schools, dropped ${dropped} (low geocode relevance)`);

  if (args.dryRun) {
    console.log("(dry-run; not writing to DB)");
    console.log(upserts.slice(0, 3));
    return;
  }

  const CHUNK = 100;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const slice = upserts.slice(i, i + CHUNK);
    const { error } = await sb.from("schools").upsert(slice);
    if (error) {
      console.error("upsert error:", error.message);
      process.exit(1);
    }
  }
  console.log(`✓ upserted ${upserts.length} school rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

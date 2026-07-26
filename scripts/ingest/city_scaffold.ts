/**
 * Scaffold a new city's config so adding one is minutes, not an audit:
 *   1. confirm the CBS semel + name + population (data.gov.il localities file),
 *   2. count its 2022 statistical areas (CBS ArcGIS — the authoritative figure),
 *   3. suggest anchor neighborhoods from OSM `place` nodes (a DRAFT to review),
 *   4. print a ready-to-paste CityConfig + lib/cities.ts entry.
 *
 * The stat-area count is authoritative; the anchor list is a starting point —
 * OSM place nodes are often incomplete/noisy (Or Yehuda's were), so cross-check
 * against Wikipedia + the municipal site, or run a neighborhood-research agent.
 *
 * Usage:  npm run city:scaffold -- --semel 6900
 *         npm run city:scaffold -- --name "כפר סבא"
 */
const UA = "MishpachaMap/0.1 (city scaffold)";
const CBS_LOCALITIES = "199b15db-3bcb-470e-ba03-73364737e352";
const ARCGIS =
  "https://services8.arcgis.com/JcXY3lLZni6BK4El/arcgis/rest/services/statistical_areas_2022/FeatureServer/0/query";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}
async function overpass(query: string): Promise<any> {
  const body = "data=" + encodeURIComponent(query);
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]) {
    try {
      const res = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA }, body });
      if (res.ok) { const t = await res.text(); if (!t.startsWith("<")) return JSON.parse(t); }
    } catch { /* try next endpoint */ }
  }
  throw new Error("Overpass: all endpoints failed");
}
const slug = (en: string, i: number) => (en ? en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : `nb-${i + 1}`);

/** Ray-casting point-in-ring + point-in-any-stat-area, to prune OSM candidates
 *  that the bbox pulled in from neighboring localities. */
function ptInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inCity(lng: number, lat: number, feats: any[]): boolean {
  for (const f of feats) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
    for (const poly of polys) if (poly?.[0] && ptInRing(lng, lat, poly[0])) return true;
  }
  return false;
}

async function main() {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
  const semelArg = arg("--semel");
  const nameArg = arg("--name");
  if (!semelArg && !nameArg) {
    console.error('Usage: npm run city:scaffold -- --semel 6900   (or)   --name "כפר סבא"');
    process.exit(1);
  }

  // 1) Confirm the locality.
  console.log("→ confirming locality (CBS localities file)…");
  const q = encodeURIComponent(semelArg ?? nameArg!);
  const loc = await getJson(`https://data.gov.il/api/3/action/datastore_search?resource_id=${CBS_LOCALITIES}&q=${q}&limit=20`);
  const recs: any[] = loc.result?.records ?? [];
  const rec = semelArg ? recs.find((r) => String(r["סמל יישוב"]) === String(semelArg)) : recs.find((r) => String(r["שם יישוב"]).trim() === nameArg!.trim()) ?? recs[0];
  if (!rec) { console.error(`✗ no locality found for ${semelArg ?? nameArg}. Check the name/semel.`); process.exit(1); }
  const semel = Number(rec["סמל יישוב"]);
  const nameHe = String(rec["שם יישוב"]).trim();
  console.log(`  ✓ ${nameHe}  semel=${semel}  pop=${rec["סך הכל אוכלוסייה 2022"] ?? rec["סך אוכלוסייה 2022"] ?? "?"}  district=${rec["שם מחוז"] ?? "?"}`);
  if (CITIES_HAS(semel)) console.warn(`  ⚠ a city with semel ${semel} may already be configured.`);

  // 2) Statistical areas (authoritative count + bbox).
  console.log("→ counting CBS 2022 statistical areas…");
  const sa = await getJson(`${ARCGIS}?where=SEMEL_YISHUV%3D${semel}&outFields=STAT_2022&outSR=4326&f=geojson`);
  const feats: any[] = sa.features ?? [];
  let w = 180, s = 90, e = -180, n = -90;
  for (const f of feats) for (const ring of (f.geometry?.coordinates ?? [])) for (const part of (Array.isArray(ring[0][0]) ? ring : [ring])) for (const [lng, lat] of part) { if (lng < w) w = lng; if (lng > e) e = lng; if (lat < s) s = lat; if (lat > n) n = lat; }
  console.log(`  ✓ ${feats.length} statistical areas · bbox [${w.toFixed(3)},${s.toFixed(3)} → ${e.toFixed(3)},${n.toFixed(3)}]`);

  // 3) OSM place-node anchor candidates (DRAFT — review!).
  console.log("→ fetching OSM place nodes (candidate neighborhoods)…");
  let nodes: any[] = [];
  try {
    const osm = await overpass(`[out:json][timeout:60];node["place"~"suburb|neighbourhood|quarter"](${s},${w},${n},${e});out;`);
    // Keep only nodes physically inside the locality's statistical areas (prunes
    // neighbors the bbox pulled in), and drop numeric-name junk nodes.
    nodes = (osm.elements ?? []).filter((el: any) => el.tags?.name && !/^\d+$/.test(el.tags.name.trim()) && inCity(el.lon, el.lat, feats));
  } catch (err) { console.warn(`  ⚠ Overpass failed (${(err as Error).message}); no anchor candidates.`); }
  const cand = nodes.map((el, i) => ({ id: slug(el.tags["name:en"] ?? "", i), name_he: el.tags.name, name_en: el.tags["name:en"] ?? "", lng: Math.round(el.lon * 1e5) / 1e5, lat: Math.round(el.lat * 1e5) / 1e5 }));
  console.log(`  ✓ ${cand.length} OSM place-node candidates (bbox may include neighbors — prune!)`);

  const id = (rec["תעתיק"] ?? nameHe).toString().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || `city${semel}`;
  console.log(`\n════════ DRAFT config — REVIEW the anchors (OSM is noisy/incomplete) ════════\n`);
  console.log(`// scripts/ingest/cities.ts — add to CITIES and register below`);
  console.log(`const ${id}: CityConfig = {`);
  console.log(`  id: "${id}", semelYishuv: ${semel},`);
  console.log(`  outFile: "public/neighborhoods.${id}.geo.json",`);
  console.log(`  anchors: [`);
  for (const c of cand) console.log(`    { id: "${c.id}", name_he: "${c.name_he}", name_en: "${c.name_en}", lng: ${c.lng}, lat: ${c.lat} },`);
  console.log(`  ],`);
  console.log(`  demographicsOut: "${id}.demographics.json", crimeOut: "${id}.crime.json", schoolsOut: "${id}.schools.json",`);
  console.log(`  transitOut: "${id}.transit.json", environmentOut: "${id}.environment.json", pricesOut: "${id}.prices.json",`);
  console.log(`  moeCityName: "${nameHe}", gtfsCityName: "${nameHe}",`);
  console.log(`};\n`);
  console.log(`Then: add \`${id}\` to CITIES (both files), run \`npm run city:build -- --city ${id}\`, then \`npm run city:qa -- --city ${id}\`.`);
  console.log(`⚠ The ${feats.length}-area count is authoritative; the ${cand.length} anchors are a DRAFT — prune neighbors, add missing neighborhoods (cross-check Wikipedia + the municipal site), and add statOverrides for boundary areas.\n`);
}

// Lazy require to avoid a hard dep when scaffolding a brand-new city.
function CITIES_HAS(semel: number): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CITIES } = require("./cities");
    return Object.values(CITIES).some((c: any) => c.semelYishuv === semel);
  } catch { return false; }
}

main().catch((e) => { console.error(e); process.exit(1); });

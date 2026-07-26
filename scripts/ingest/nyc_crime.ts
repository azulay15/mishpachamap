/**
 * NYC POC — per-neighborhood safety from NYPD Complaint Data (historic,
 * dataset qgea-i56i), 2023–2024, joined to NTAs by point-in-polygon.
 *
 * Simpler than the Israeli pipeline: NYPD rows carry real lat/lng, so there's
 * no police-area→neighborhood name crosswalk — every complaint lands in the
 * neighborhood it physically occurred in.
 *
 * Counts are reported FELONY complaints (the serious-crime signal). Rates
 * per-1,000 residents need population — added once demographics land; until
 * then we publish counts + a density-based score and leave rate null (honest).
 *
 * No API key needed (a free Socrata app token just raises rate limits).
 * Usage:  npx tsx scripts/ingest/nyc_crime.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

const DATASET = "https://data.cityofnewyork.us/resource/qgea-i56i.json";
const FROM = "2023-01-01T00:00:00";
const TO = "2024-12-31T23:59:59";
const PAGE = 50000;

type Row = { latitude?: string; longitude?: string; law_cat_cd?: string; ofns_desc?: string };

async function fetchPage(offset: number): Promise<Row[]> {
  const qs = new URLSearchParams({
    $select: "latitude,longitude,law_cat_cd,ofns_desc",
    $where: `cmplnt_fr_dt between '${FROM}' and '${TO}' and latitude IS NOT NULL and law_cat_cd='FELONY'`,
    $limit: String(PAGE),
    $offset: String(offset),
  });
  const res = await fetch(`${DATASET}?${qs}`, { headers: { Accept: "application/json", "User-Agent": "MishpachaMap/0.1" } });
  if (!res.ok) throw new Error(`NYPD: ${res.status} ${res.statusText}`);
  return (await res.json()) as Row[];
}

async function main() {
  const geoPath = resolve(process.cwd(), "public", "neighborhoods.nyc.geo.json");
  if (!existsSync(geoPath)) throw new Error("run nyc_geo.ts first");
  const geo = JSON.parse(readFileSync(geoPath, "utf8")) as {
    features: Array<{ geometry: Polygon; properties: { id: string; name_he: string } }>;
  };
  const polys = geo.features.map((f) => ({ id: f.properties.id, name: f.properties.name_he, f: turf.feature(f.geometry) as Feature<Polygon>, bbox: turf.bbox(f.geometry) }));
  const cityBbox = turf.bbox(turf.featureCollection(geo.features.map((f) => turf.feature(f.geometry)) as never));

  console.log(`→ fetching NYPD felony complaints ${FROM.slice(0, 10)}…${TO.slice(0, 10)} (qgea-i56i)…`);
  const counts = new Map<string, { total: number; violent: number; property: number }>();
  let fetched = 0, inCity = 0, offset = 0;
  const VIOLENT = /ASSAULT|ROBBERY|MURDER|HOMICIDE|RAPE|SEX CRIMES|FELONY ASSAULT/i;
  const PROPERTY = /BURGLARY|LARCENY|THEFT|VEHICLE|ARSON|MISCHIEF/i;

  for (;;) {
    const rows = await fetchPage(offset);
    if (rows.length === 0) break;
    fetched += rows.length;
    for (const r of rows) {
      const lat = Number(r.latitude), lng = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // cheap city-bbox reject before the expensive point-in-polygon
      if (lng < cityBbox[0] || lng > cityBbox[2] || lat < cityBbox[1] || lat > cityBbox[3]) continue;
      const pt = turf.point([lng, lat]);
      for (const p of polys) {
        if (lng < p.bbox[0] || lng > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
        if (!turf.booleanPointInPolygon(pt, p.f)) continue;
        const c = counts.get(p.id) ?? { total: 0, violent: 0, property: 0 };
        c.total++;
        const d = r.ofns_desc ?? "";
        if (VIOLENT.test(d)) c.violent++;
        else if (PROPERTY.test(d)) c.property++;
        counts.set(p.id, c);
        inCity++;
        break;
      }
    }
    console.log(`  …${fetched} rows scanned, ${inCity} inside the POC neighborhoods`);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  const out: Record<string, unknown> = {};
  for (const p of polys) {
    const c = counts.get(p.id);
    out[p.id] = c
      ? {
          name: p.name,
          cases_total: c.total,
          cases_violent: c.violent,
          cases_property: c.property,
          per_1000_residents: null, // filled once demographics land
          safety_score: null,
          source: { provider: "NYPD Complaint Data Historic (NYC Open Data qgea-i56i)", period: "2023–2024", note: "reported FELONY complaints, point-in-NTA" },
        }
      : null;
  }
  writeFileSync(
    resolve(process.cwd(), "public", "nyc.crime.json"),
    JSON.stringify({ meta: { source: "NYPD Complaint Data Historic", dataset: "qgea-i56i", period: "2023-2024" }, neighborhoods: out }, null, 2) + "\n",
    "utf8",
  );
  const covered = Object.values(out).filter(Boolean).length;
  console.log(`\nneighborhood                                  felonies  violent  property`);
  for (const p of polys) {
    const c = counts.get(p.id);
    if (c) console.log(`  ${p.name.slice(0, 42).padEnd(43)} ${String(c.total).padStart(6)}  ${String(c.violent).padStart(7)}  ${String(c.property).padStart(8)}`);
  }
  console.log(`\n✓ wrote public/nyc.crime.json — ${covered}/${polys.length} neighborhoods`);
}

main().catch((e) => { console.error(e); process.exit(1); });

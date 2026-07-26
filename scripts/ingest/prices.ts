/**
 * Real sale-price metrics per neighborhood from the Govmap deals API, written
 * as a STATIC per-city file — the multi-city, no-DB equivalent of the
 * `nadlan_govmap → transactions → compute_metrics` chain that Modi'in uses.
 *
 * ACCURATE neighborhood assignment: each Govmap deal carries a `shape` (its
 * parcel polygon, Web Mercator). We take the parcel centroid, reproject to
 * WGS84, and point-in-polygon it against the neighborhood boundaries — so a
 * deal lands in the neighborhood it's physically in, not "whichever centroid
 * scanned first" (which fails on compact cities). Deals outside every polygon
 * are dropped.
 *
 * HONESTY RULE (same as compute_metrics): a neighborhood's price is published
 * only when backed by >= MIN_SALES real sales inside WINDOW_MONTHS; otherwise
 * its fields are null and the UI shows "אין נתוני מחיר". YoY needs >=
 * MIN_SALES_YOY in BOTH the last 12mo and the prior 12mo.
 *
 * Usage:
 *   npx tsx scripts/ingest/prices.ts --city oryehuda [--radius=1500]
 * Reads open data + a local geo file, writes a file. No Supabase needed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { CITIES } from "./cities";

const GOVMAP = "https://www.govmap.gov.il/api";
const UA = "Mozilla/5.0 MishpachaMap-ingest";

const MIN_SALES = 4;
const WINDOW_MONTHS = 48;
const MIN_SALES_YOY = 8;
/** National-safe price/m² sanity bounds; median is robust so we only trim
 *  clear data errors (typos, misclassified storage/land). */
const PPM_MIN = 6000;
const PPM_MAX = 120000;

const WINDOW_START = isoMonthsAgo(WINDOW_MONTHS);
const ONE_YEAR_AGO = isoMonthsAgo(12);
const TWO_YEARS_AGO = isoMonthsAgo(24);

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function toWebMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.34) / 180;
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (20037508.34 / 180);
  return [x, y];
}
function fromWebMercator(x: number, y: number): [number, number] {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

/** Centroid (WGS84 lng,lat) of a Govmap `shape` WKT (Web Mercator), or null. */
function shapeCentroidWgs84(shape: string | null | undefined): [number, number] | null {
  if (!shape) return null;
  const pairs = [...shape.matchAll(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g)];
  if (pairs.length === 0) return null;
  let sx = 0, sy = 0;
  for (const m of pairs) { sx += Number(m[1]); sy += Number(m[2]); }
  return fromWebMercator(sx / pairs.length, sy / pairs.length);
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Govmap ${res.status}`);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`Govmap exhausted retries for ${url}: ${(lastErr as Error)?.message}`);
}

const APARTMENT_NATURES = new Set([
  "דירה", "דירת גן", "דירת גג / פנטהאוז", "פנטהאוז", "דירת גג",
  "דופלקס", "קוטג'", "וילה", "קוטג' / וילה", "דירת נופש",
]);

type PolygonMeta = { polygon_id: string; dealscount: string };
type Deal = {
  settlementId: number | null;
  assetArea: number | null;
  assetRoomNum: number | null;
  dealAmount: number | null;
  dealDate: string | null;
  dealNatureDescription: string | null;
  shape: string | null;
};
type Tx = { ppm: number; price: number; rooms: number | null; date: string };

type NbPoly = { id: string; feature: Feature<Polygon> };

function loadPolys(geoFile: string): NbPoly[] {
  const fc = JSON.parse(readFileSync(resolve(process.cwd(), geoFile), "utf8")) as {
    features: Array<{ properties: { id?: string }; geometry: Polygon }>;
  };
  const out: NbPoly[] = [];
  for (const f of fc.features) {
    if (!f.properties?.id) continue;
    out.push({ id: f.properties.id, feature: turf.feature(f.geometry) as Feature<Polygon> });
  }
  return out;
}

/** Neighborhood containing the point, else the NEAREST neighborhood boundary.
 *  Deals are pre-filtered to the city (by settlementId), so a parcel that falls
 *  in a street-gap between the built-up-clipped polygons is legitimately in the
 *  city and belongs to its nearest neighborhood. Returns null only if there are
 *  no polygons. */
function assign(polys: NbPoly[], lng: number, lat: number): string | null {
  const pt = turf.point([lng, lat]);
  let best: string | null = null;
  let bestKm = Infinity;
  for (const p of polys) {
    if (turf.booleanPointInPolygon(pt, p.feature)) return p.id;
    const line = turf.lineString(p.feature.geometry.coordinates[0]);
    const d = turf.pointToLineDistance(pt, line, { units: "kilometers" });
    if (d < bestKm) { bestKm = d; best = p.id; }
  }
  return best;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function mean(nums: number[]): number | null {
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0) / nums.length;
}
const round = (n: number | null) => (n == null ? null : Math.round(n));

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
  const radius = (() => {
    const a = process.argv.find((x) => x.startsWith("--radius="));
    return a ? Number(a.slice("--radius=".length)) : 1500;
  })();
  const outName = city.pricesOut ?? `${city.id}.prices.json`;

  // Assign against the UNCLIPPED extents (true boundaries, incl. street gaps)
  // when available; the display-clipped shapes drop legit near-boundary parcels.
  const rawFile = city.outFile.replace(/\.geo\.json$/, ".raw.geo.json");
  const geoForAssign = existsSync(resolve(process.cwd(), rawFile)) ? rawFile : city.outFile;
  const polys = loadPolys(geoForAssign);
  console.log(`→ ${city.id}: ${polys.length} neighborhood polygons (${geoForAssign}), scan radius=${radius}m`);

  // Enumerate street polygons across the city (scan each neighborhood centroid;
  // dedupe by polygon_id — assignment is by deal shape, not by who scanned).
  const polygonIds = new Set<string>();
  for (const p of polys) {
    const c = turf.centroid(p.feature).geometry.coordinates as [number, number];
    const [x, y] = toWebMercator(c[0], c[1]);
    const found = await fetchJson<PolygonMeta[]>(`${GOVMAP}/real-estate/deals/${x.toFixed(1)},${y.toFixed(1)}/${radius}`);
    for (const q of found) if (Number(q.dealscount) > 0) polygonIds.add(q.polygon_id);
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`→ ${polygonIds.size} street polygons with deals; fetching…`);

  const txByNb = new Map<string, Tx[]>();
  let processed = 0, kept = 0, unassigned = 0;
  for (const pid of polygonIds) {
    processed++;
    const body = await fetchJson<{ data: Deal[] }>(`${GOVMAP}/real-estate/street-deals/${pid}`);
    for (const d of body.data ?? []) {
      // Only deals in THIS city — the wide scan pulls in neighbor cities
      // (Kiryat Ono / Yehud / Azor); settlementId excludes them cleanly.
      if (d.settlementId != null && d.settlementId !== city.semelYishuv) continue;
      const nature = (d.dealNatureDescription ?? "").trim();
      if (nature && !APARTMENT_NATURES.has(nature)) continue;
      const price = Number(d.dealAmount);
      const sqm = Number(d.assetArea);
      const date = d.dealDate?.slice(0, 10);
      if (!price || !sqm || sqm <= 0 || !date) continue;
      const ppm = price / sqm;
      if (ppm < PPM_MIN || ppm > PPM_MAX) continue;
      const c = shapeCentroidWgs84(d.shape);
      if (!c) { unassigned++; continue; }
      const nbId = assign(polys, c[0], c[1]);
      if (!nbId) { unassigned++; continue; }
      (txByNb.get(nbId) ?? txByNb.set(nbId, []).get(nbId)!).push({ ppm: Math.round(ppm), price, rooms: d.assetRoomNum != null ? Number(d.assetRoomNum) : null, date });
      kept++;
    }
    if (processed % 25 === 0) console.log(`  …${processed}/${polygonIds.size}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\n→ ${kept} apartment deals assigned (${unassigned} dropped: no shape / outside all polygons)`);

  const out: Record<string, unknown> = {};
  for (const p of polys) {
    const all = (txByNb.get(p.id) ?? []).filter((t) => t.date >= WINDOW_START);
    if (all.length < MIN_SALES) {
      out[p.id] = null;
      console.log(`  ○ ${p.id.padEnd(22)} ${all.length} sales in ${WINDOW_MONTHS}mo (need ${MIN_SALES}) — no data`);
      continue;
    }
    const avgPpm = round(mean(all.map((t) => t.ppm)));
    const medSale = round(median(all.map((t) => t.price)));
    const medRooms = median(all.map((t) => t.rooms ?? 0).filter((r) => r > 0));
    const recent = all.filter((t) => t.date >= ONE_YEAR_AGO);
    const prior = all.filter((t) => t.date < ONE_YEAR_AGO && t.date >= TWO_YEARS_AGO);
    let yoy: number | null = null;
    if (recent.length >= MIN_SALES_YOY && prior.length >= MIN_SALES_YOY) {
      const r = mean(recent.map((t) => t.ppm));
      const pr = mean(prior.map((t) => t.ppm));
      if (r != null && pr != null && pr > 0) yoy = Math.round(((r - pr) / pr) * 1000) / 10;
    }
    out[p.id] = { avg_price_per_m2: avgPpm, avg_listing_price: medSale, avg_price_yoy_pct: yoy, median_rooms: medRooms, sales_in_window: all.length };
    console.log(`  ✓ ${p.id.padEnd(22)} ₪${avgPpm}/m² · median ₪${((medSale ?? 0) / 1e6).toFixed(2)}M · ${all.length} sales · yoy=${yoy != null ? yoy + "%" : "—"}`);
  }

  const covered = Object.values(out).filter(Boolean).length;
  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify(
      { meta: { source: "Govmap real-estate deals (govmap.gov.il)", city: city.id, window_months: WINDOW_MONTHS, min_sales: MIN_SALES, as_of: isoMonthsAgo(0) }, neighborhoods: out },
      null, 2,
    ) + "\n",
    "utf8",
  );
  console.log(`\n→ wrote public/${outName} — ${covered}/${polys.length} neighborhoods with real price data`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

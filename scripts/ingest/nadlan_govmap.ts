/**
 * Real Nadlan (Israeli real-estate) transactions ingest via Govmap API.
 *
 * Govmap (govmap.gov.il) is the only IL government source that serves
 * per-transaction deal data through a simple HTTP API. It uses Web Mercator
 * (EPSG:3857) coordinates, not WGS84.
 *
 * Per neighborhood centroid → /deals/ returns street polygons + dealscount
 * → /street-deals/{polygonId} returns the per-deal records.
 *
 * Usage:
 *   npm run ingest:nadlan:govmap -- [--radius=1500] [--source=govmap-2026-05] [--replace] [--dry-run]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "./_env";
import { sb } from "./_env";

const GOVMAP = "https://www.govmap.gov.il/api";
const UA = "Mozilla/5.0 MishpachaMap-ingest";

type Args = {
  radius: number;
  source: string;
  replace: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let radius = 1500;
  let source = "govmap-2026-05";
  let replace = false;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--radius=")) radius = Number(a.slice("--radius=".length));
    else if (a.startsWith("--source=")) source = a.slice("--source=".length);
    else if (a === "--replace") replace = true;
    else if (a === "--dry-run") dryRun = true;
  }
  return { radius, source, replace, dryRun };
}

/** WGS84 (lat/lng) → Web Mercator (EPSG:3857) — pure formula, no library. */
function toWebMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.34 / 180);
  return [x, y];
}

type Neighborhood = {
  id: string;
  center: [number, number]; // [lng, lat]
};

function loadNeighborhoodCentroids(): Neighborhood[] {
  const path = resolve(process.cwd(), "public", "neighborhoods.geo.json");
  const fc = JSON.parse(readFileSync(path, "utf8")) as {
    features: {
      properties: { id?: string };
      geometry: { type: string; coordinates: number[][][] | number[][][][] };
    }[];
  };
  const out: Neighborhood[] = [];
  for (const f of fc.features) {
    const id = f.properties?.id;
    if (!id) continue;
    // Centroid: average of polygon vertices (simple, good enough).
    const coords = (f.geometry.type === "Polygon"
      ? (f.geometry.coordinates as number[][][])[0]
      : (f.geometry.coordinates as number[][][][])[0][0]) as number[][];
    let sx = 0,
      sy = 0;
    for (const [lng, lat] of coords) {
      sx += lng;
      sy += lat;
    }
    out.push({ id, center: [sx / coords.length, sy / coords.length] });
  }
  return out;
}

type PolygonMeta = {
  polygon_id: string;
  dealscount: string;
};

type Deal = {
  dealId: number;
  settlementId: number;
  settlementNameHeb: string | null;
  streetNameHeb: string | null;
  houseNum: number | null;
  floorNo: string | null;
  assetArea: number | null;
  assetRoomNum: number | null;
  dealAmount: number | null;
  dealDate: string | null;
  propertyTypeDescription: string | null;
  dealNatureDescription: string | null;
  polygonId: string;
};

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
      throw new Error(`Govmap ${res.status}: ${await res.text()}`);
    } catch (e) {
      // Govmap drops connections (ECONNRESET / fetch failed) under sustained
      // polling. Treat as transient and back off.
      lastErr = e;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`Govmap exhausted retries for ${url}: ${(lastErr as Error)?.message}`);
}

/** Apartment-like deal natures we keep. The rest (חנות / משרד / מחסן) are
 *  commercial/storage and irrelevant for family-housing comparables. */
const APARTMENT_NATURES = new Set([
  "דירה",
  "דירת גן",
  "דירת גג / פנטהאוז",
  "פנטהאוז",
  "דירת גג",
  "דופלקס",
  "קוטג'",
  "וילה",
  "קוטג' / וילה",
  "דירת נופש",
]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const neighborhoods = loadNeighborhoodCentroids();
  console.log(`→ ${neighborhoods.length} neighborhoods to scan, radius=${args.radius}m`);

  // Polygon dedup: many neighborhood-centroid queries pull the same street
  // polygons. Track polygon_id → first neighborhood that claimed it.
  const polygonOwner = new Map<string, string>();

  for (const n of neighborhoods) {
    const [x, y] = toWebMercator(n.center[0], n.center[1]);
    const url = `${GOVMAP}/real-estate/deals/${x.toFixed(1)},${y.toFixed(1)}/${args.radius}`;
    const polys = await fetchJson<PolygonMeta[]>(url);
    let added = 0;
    for (const p of polys) {
      if (Number(p.dealscount) === 0) continue;
      if (polygonOwner.has(p.polygon_id)) continue;
      polygonOwner.set(p.polygon_id, n.id);
      added++;
    }
    console.log(`  ${n.id.padEnd(15)} ${polys.length} polygons, ${added} new`);
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n→ fetching deals for ${polygonOwner.size} unique polygons`);
  const rows: Array<{
    neighborhood: string;
    address: string | null;
    rooms: number | null;
    sqm: number;
    price_nis: number;
    price_per_m2: number;
    tx_date: string;
    source: string;
  }> = [];
  let totalDeals = 0;
  let skipped = 0;
  let processed = 0;

  for (const [polygonId, neighborhoodId] of polygonOwner) {
    processed++;
    const url = `${GOVMAP}/real-estate/street-deals/${polygonId}`;
    const body = await fetchJson<{ data: Deal[] }>(url);
    for (const d of body.data ?? []) {
      totalDeals++;
      const nature = (d.dealNatureDescription ?? "").trim();
      if (nature && !APARTMENT_NATURES.has(nature)) {
        skipped++;
        continue;
      }
      const price = Number(d.dealAmount);
      const sqm = Number(d.assetArea);
      const date = d.dealDate?.slice(0, 10);
      if (!price || !sqm || sqm <= 0 || !date) {
        skipped++;
        continue;
      }
      // Sanity bounds — Modi'in apartments in 2020-2025 trade between
      // ₪8k-₪70k/m². Anything outside is a data error (typo, storage with
      // tiny sqm, misclassified office, etc.).
      const ppm = price / sqm;
      if (ppm < 8000 || ppm > 70000) {
        skipped++;
        continue;
      }
      const addressParts: string[] = [];
      if (d.streetNameHeb) addressParts.push(d.streetNameHeb);
      if (d.houseNum != null) addressParts.push(String(d.houseNum));
      const address = addressParts.length ? addressParts.join(" ") : null;
      rows.push({
        neighborhood: neighborhoodId,
        address,
        rooms: d.assetRoomNum != null ? Number(d.assetRoomNum) : null,
        sqm,
        price_nis: price,
        price_per_m2: Math.round(price / sqm),
        tx_date: date,
        source: args.source,
      });
    }
    if (processed % 25 === 0) console.log(`  …${processed}/${polygonOwner.size}`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\n→ ${rows.length} apartment deals (of ${totalDeals} total; ${skipped} skipped — non-apartment / missing fields)`,
  );

  if (rows.length === 0) {
    console.log("nothing to write");
    return;
  }
  if (args.dryRun) {
    console.log("(dry-run; not writing to DB)");
    console.log(rows.slice(0, 3));
    return;
  }

  if (args.replace) {
    const { error } = await sb.from("transactions").delete().eq("source", args.source);
    if (error) {
      console.error("delete error:", error.message);
      process.exit(1);
    }
    console.log(`  cleared prior rows for source=${args.source}`);
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("transactions").insert(slice);
    if (error) {
      console.error("insert error:", error.message);
      process.exit(1);
    }
  }
  console.log(`✓ inserted ${rows.length} transactions (source=${args.source})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

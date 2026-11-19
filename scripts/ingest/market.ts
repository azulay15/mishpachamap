/**
 * Rent + sale prices BY APARTMENT SIZE per neighborhood, from the government
 * real-estate site (nadlan.gov.il — Ministry of Justice / Tax Authority data),
 * written as a STATIC per-city file: public/<city>.market.json.
 *
 * Why this source: it is the only open, official one that publishes RENT at
 * neighborhood level, split by room count (3 / 4 / 5 rooms + all sizes), as a
 * quarterly series. The same files carry the sale-price series by room count,
 * so "what does a 4-room flat cost here" is answered for buying AND renting
 * from one consistent source. (prices.ts — Govmap deals — stays the source for
 * price-per-m² and the all-sizes median; this adds the by-size view.)
 *
 * Neighborhood matching: nadlan.gov.il has its OWN neighborhood list per city,
 * which does not line up 1:1 with ours (ours are built from CBS statistical
 * areas). Each of their neighborhoods carries a centre point (Israel TM grid),
 * so we reproject it and point-in-polygon it against our boundaries. Several of
 * theirs can land in one of ours (we average them); one of ours can get none
 * (it is published as null — the app then shows the city figure, labelled as
 * such, never as the neighborhood's own).
 *
 * HONESTY RULE: a figure is published only when the source itself reports it.
 * We prefer their "last 12 months average"; if absent we average the quarters
 * of the last 2 years that have a value, and need at least MIN_QUARTERS.
 *
 * Usage:  npx tsx scripts/ingest/market.ts --city herzliya
 *         npx tsx scripts/ingest/market.ts --all
 * Reads open data + a local geo file, writes a file. No Supabase needed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { CITIES, type CityConfig } from "./cities";

const BASE = "https://data.nadlan.gov.il/api/pages";
const UA = "Mozilla/5.0 (neighborhood-data-ingest)";

const ROOM_KEYS = ["3", "4", "5", "all"] as const;
type RoomKey = (typeof ROOM_KEYS)[number];
type Kind = "rent" | "buy";

/** Quarters with a value needed when the source has no 12-month average. */
const MIN_QUARTERS = 2;
/** How far back the quarterly fallback may reach. */
const FALLBACK_QUARTERS = 8;
/** A source centre this close to one of our polygons still counts as inside it. */
const NEAR_KM = 0.35;
/** Sanity bounds — drop obvious source errors. */
const BOUNDS: Record<Kind, [number, number]> = { rent: [1200, 40000], buy: [300_000, 40_000_000] };

type GraphPoint = {
  neighborhoodPrice?: number | null;
  settlementPrice?: number | null;
  year: number;
  month: number;
};
type RoomTrend = {
  numRooms: number | string;
  graphData: GraphPoint[];
  summary?: { lastYearAvgPrice?: number | null; priceDifferencePercentage?: number | string | null };
};
type Page = {
  x?: number;
  y?: number;
  version?: string;
  neighborhoodName?: string;
  otherNeighborhoods?: Array<{ title: string; id: number }>;
  trends?: { rooms?: RoomTrend[]; indexes?: { yield?: number | string | null } };
};

export type SizePrices = Partial<Record<RoomKey, number>>;
export type MarketEntry = {
  rent: SizePrices;
  buy: SizePrices;
  /** % change of the all-sizes rent vs the previous year, when reported. */
  rent_change_pct: number | null;
  /** Gross rental yield %, when reported. */
  yield_pct: number | null;
  /** The source's neighborhood names that were folded into this one. */
  sources: string[];
};

async function fetchPage(path: string): Promise<Page | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": UA } });
      if (res.status === 404 || res.status === 403) return null;
      if (res.ok) {
        const text = (await res.text()).replace(/^﻿/, "");
        return JSON.parse(text) as Page;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
}

/** Israel TM grid (EPSG:2039) → WGS84 lng/lat. GRS80 ≈ WGS84 to well under a
 *  metre, which is far finer than a neighborhood centre needs. */
export function itmToWgs84(E: number, N: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const k0 = 1.0000067;
  const lat0 = (31.7343936111111 * Math.PI) / 180;
  const lon0 = (35.2045169444444 * Math.PI) / 180;
  const FE = 219529.584;
  const FN = 626907.39;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const M = (lat: number) =>
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));
  const M1 = M(lat0) + (N - FN) / k0;
  const mu = M1 / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const C1 = ep2 * cos1 ** 2;
  const T1 = tan1 ** 2;
  const N1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
  const R1 = (a * (1 - e2)) / (1 - e2 * sin1 ** 2) ** 1.5;
  const D = (E - FE) / (N1 * k0);
  const lat =
    phi1 -
    ((N1 * tan1) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6) / 720);
  const lon =
    lon0 +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5) / 120) /
      cos1;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** One figure per room key from a page's trends. `field` picks the series. */
function sizePrices(page: Page | null, kind: Kind, field: "neighborhoodPrice" | "settlementPrice"): SizePrices {
  const out: SizePrices = {};
  const [lo, hi] = BOUNDS[kind];
  for (const t of page?.trends?.rooms ?? []) {
    const key = String(t.numRooms) as RoomKey;
    if (!ROOM_KEYS.includes(key)) continue;
    // The 12-month summary describes the page's own subject (a neighborhood
    // page → the neighborhood; a settlement page → the settlement).
    const ownsSummary = field === "neighborhoodPrice" ? page?.neighborhoodName != null : page?.neighborhoodName == null;
    let v = ownsSummary ? num(t.summary?.lastYearAvgPrice) : null;
    if (v == null) {
      const recent = [...(t.graphData ?? [])]
        .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
        .slice(0, FALLBACK_QUARTERS)
        .map((g) => num(g[field]))
        .filter((x): x is number => x != null && x > 0);
      if (recent.length >= MIN_QUARTERS) v = recent.reduce((s, x) => s + x, 0) / recent.length;
    }
    if (v != null && v >= lo && v <= hi) out[key] = Math.round(v / (kind === "rent" ? 10 : 1000)) * (kind === "rent" ? 10 : 1000);
  }
  return out;
}

function allSizesChange(page: Page | null): number | null {
  const t = (page?.trends?.rooms ?? []).find((r) => String(r.numRooms) === "all");
  const v = num(t?.summary?.priceDifferencePercentage);
  // The source occasionally reports wild swings on thin data; keep plausible ones.
  return v != null && Math.abs(v) <= 30 ? Math.round(v * 10) / 10 : null;
}

type Poly = { id: string; name_he: string; feature: Feature<Polygon | MultiPolygon> };

function loadPolys(geoFile: string): Poly[] {
  const fc = JSON.parse(readFileSync(resolve(process.cwd(), geoFile), "utf8")) as {
    features: Array<{ properties: { id?: string; name_he?: string }; geometry: Polygon | MultiPolygon }>;
  };
  return fc.features
    .filter((f) => f.properties?.id)
    .map((f) => ({
      id: f.properties.id!,
      name_he: f.properties.name_he ?? "",
      feature: turf.feature(f.geometry) as Feature<Polygon | MultiPolygon>,
    }));
}

/** Hebrew name normalised for loose equality (quotes, hyphens, "שכונת", ה-). */
export function normName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/["'׳״`.,()]/g, "")
    .replace(/[-–־]/g, " ")
    .replace(/^(שכונת|שכ|קרית|קריית)\s+/, (m) => (m.startsWith("קר") ? "קרית " : ""))
    .replace(/יי/g, "י")
    .replace(/וו/g, "ו")
    .replace(/\s+/g, " ")
    .trim();
}

function locate(polys: Poly[], lng: number, lat: number): string | null {
  const pt = turf.point([lng, lat]);
  let best: string | null = null;
  let bestKm = Infinity;
  for (const p of polys) {
    if (turf.booleanPointInPolygon(pt, p.feature)) return p.id;
    const d = turf.pointToPolygonDistance(pt, p.feature, { units: "kilometers" });
    if (d < bestKm) {
      bestKm = d;
      best = p.id;
    }
  }
  return bestKm <= NEAR_KM ? best : null;
}

function mergeSizes(list: SizePrices[], kind: Kind): SizePrices {
  const out: SizePrices = {};
  const step = kind === "rent" ? 10 : 1000;
  for (const k of ROOM_KEYS) {
    const vals = list.map((s) => s[k]).filter((x): x is number => x != null);
    if (vals.length) out[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / step) * step;
  }
  return out;
}

async function buildCity(city: CityConfig) {
  const rawFile = city.outFile.replace(/\.geo\.json$/, ".raw.geo.json");
  const geoFile = existsSync(resolve(process.cwd(), rawFile)) ? rawFile : city.outFile;
  if (!existsSync(resolve(process.cwd(), geoFile))) {
    console.error(`✗ ${city.id}: no geo file (${geoFile}) — build polygons first.`);
    return false;
  }
  const polys = loadPolys(geoFile);
  console.log(`\n→ ${city.id} (semel ${city.semelYishuv}): ${polys.length} neighborhoods`);

  const [sRent, sBuy] = await Promise.all([
    fetchPage(`settlement/rent/${city.semelYishuv}.json`),
    fetchPage(`settlement/buy/${city.semelYishuv}.json`),
  ]);
  if (!sRent && !sBuy) {
    console.error(`✗ ${city.id}: the source has no page for semel ${city.semelYishuv}.`);
    return false;
  }
  const cityEntry = {
    rent: sizePrices(sRent, "rent", "settlementPrice"),
    buy: sizePrices(sBuy, "buy", "settlementPrice"),
    rent_change_pct: allSizesChange(sRent),
    yield_pct: num(sRent?.trends?.indexes?.yield ?? sBuy?.trends?.indexes?.yield),
  };

  const theirs = (sRent ?? sBuy)!.otherNeighborhoods ?? [];
  const byPoly = new Map<string, Array<{ title: string; exact: boolean; rent: SizePrices; buy: SizePrices; change: number | null; yieldPct: number | null }>>();
  const polyByName = new Map(polys.map((p) => [normName(p.name_he), p.id]));
  let unplaced = 0;
  for (const nb of theirs) {
    const [nRent, nBuy] = await Promise.all([
      fetchPage(`neighborhood/rent/${nb.id}.json`),
      fetchPage(`neighborhood/buy/${nb.id}.json`),
    ]);
    await new Promise((r) => setTimeout(r, 150));
    const page = nRent ?? nBuy;
    if (!page) continue;
    const named = polyByName.get(normName(nb.title));
    let polyId: string | null = null;
    if (page.x && page.y) {
      const [lng, lat] = itmToWgs84(page.x, page.y);
      polyId = locate(polys, lng, lat);
    }
    // A same-name neighborhood wins over geometry (their centre can sit on a boundary).
    polyId = named ?? polyId;
    if (!polyId) {
      unplaced++;
      continue;
    }
    const entry = {
      title: String(nb.title),
      exact: named === polyId,
      rent: sizePrices(nRent, "rent", "neighborhoodPrice"),
      buy: sizePrices(nBuy, "buy", "neighborhoodPrice"),
      change: allSizesChange(nRent),
      yieldPct: num(nRent?.trends?.indexes?.yield ?? nBuy?.trends?.indexes?.yield),
    };
    (byPoly.get(polyId) ?? byPoly.set(polyId, []).get(polyId)!).push(entry);
  }

  const out: Record<string, MarketEntry | null> = {};
  let withRent = 0;
  let withBuy = 0;
  for (const p of polys) {
    let group = byPoly.get(p.id) ?? [];
    // When one of theirs IS this neighborhood by name, use it alone.
    if (group.some((g) => g.exact)) group = group.filter((g) => g.exact);
    const rent = mergeSizes(group.map((g) => g.rent), "rent");
    const buy = mergeSizes(group.map((g) => g.buy), "buy");
    if (!Object.keys(rent).length && !Object.keys(buy).length) {
      out[p.id] = null;
      console.log(`  ○ ${p.id.padEnd(26)} no figures${group.length ? ` (matched ${group.map((g) => g.title).join(", ")})` : ""}`);
      continue;
    }
    if (Object.keys(rent).length) withRent++;
    if (Object.keys(buy).length) withBuy++;
    const changes = group.map((g) => g.change).filter((x): x is number => x != null);
    const yields = group.map((g) => g.yieldPct).filter((x): x is number => x != null && x > 0 && x < 15);
    out[p.id] = {
      rent,
      buy,
      rent_change_pct: changes.length === 1 ? changes[0] : null,
      yield_pct: yields.length ? Math.round((yields.reduce((a, b) => a + b, 0) / yields.length) * 100) / 100 : null,
      sources: group.map((g) => g.title),
    };
    const fmt = (s: SizePrices, div: number) => ROOM_KEYS.map((k) => `${k}:${s[k] != null ? Math.round(s[k]! / div) : "—"}`).join(" ");
    console.log(`  ✓ ${p.id.padEnd(26)} rent[${fmt(rent, 1)}]  buy₪K[${fmt(buy, 1000)}]  ← ${group.map((g) => g.title).join(", ")}`);
  }

  const outName = `${city.id}.market.json`;
  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify(
      {
        meta: {
          source: "nadlan.gov.il — rent and sale prices by room count",
          city: city.id,
          source_version: (sRent ?? sBuy)?.version ?? null,
          as_of: new Date().toISOString().slice(0, 10),
        },
        city: cityEntry,
        neighborhoods: out,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(
    `→ wrote public/${outName} — rent: ${withRent}/${polys.length}, sale by size: ${withBuy}/${polys.length} neighborhoods` +
      ` (${theirs.length} source neighborhoods, ${unplaced} outside our boundaries)`,
  );
  return true;
}

async function main() {
  const all = process.argv.includes("--all");
  const i = process.argv.indexOf("--city");
  const ids = all ? Object.keys(CITIES) : i >= 0 ? [process.argv[i + 1]] : [];
  if (!ids.length) {
    console.error(`Usage: npx tsx scripts/ingest/market.ts --city <id> | --all   (known: ${Object.keys(CITIES).join(", ")})`);
    process.exit(1);
  }
  let failed = 0;
  for (const id of ids) {
    const city = CITIES[id];
    if (!city) {
      console.error(`Unknown city "${id}".`);
      failed++;
      continue;
    }
    if (!(await buildCity(city))) failed++;
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("market.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

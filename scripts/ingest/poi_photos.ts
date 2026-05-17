/**
 * Enrich `pois.meta` with Creative-Commons-licensed photos from Wikipedia /
 * Wikimedia Commons. Strategy:
 *
 *   1. For each POI without a photo (and not checked in the last 30 days),
 *      geosearch Hebrew Wikipedia within 200m of the POI's coordinates.
 *   2. If nothing, fall back to English Wikipedia at the same radius.
 *   3. Take the closest article that has a `pageimage` (lead image).
 *   4. Look up that file on Commons to confirm the license is CC-*, PD, or
 *      another Wikimedia-permitted license. Skip anything we can't verify as
 *      free-to-use.
 *   5. Store url + title + page url + license + artist into pois.meta.photo_*.
 *
 * Coverage will be sparse — most local shops won't have a Wikipedia article —
 * but the major parks, schools, and landmarks usually do, and we get a clean
 * legal trail per photo.
 *
 *   pnpm ingest:poi:photos                      # run for all POIs
 *   pnpm ingest:poi:photos -- --type=park       # only parks (or shop / school / community / transit)
 *   pnpm ingest:poi:photos -- --refresh         # ignore the 30-day "already checked" guard
 *   pnpm ingest:poi:photos -- --limit=20        # process at most N POIs
 */
import { sb } from "./_env";

type POIRow = {
  id: string;
  type: string;
  name_he: string | null;
  point: GeoJSON.Point;
  meta: Record<string, unknown> | null;
};

type Args = {
  type: string | null;
  refresh: boolean;
  limit: number | null;
};

type GeoSearchHit = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
};

type PageImageInfo = {
  pageid: number;
  title: string;
  fullurl: string;
  pageimage?: string;
  /** A scaled thumbnail (we request 400px via pithumbsize). */
  thumbnail?: { source: string; width: number; height: number };
  /** Full-resolution original. Kept around as a fallback if no thumbnail. */
  original?: { source: string; width: number; height: number };
};

type CommonsImageMeta = {
  url: string;
  license: string | null;
  licenseUrl: string | null;
  artist: string | null;
  description: string | null;
};

const USER_AGENT =
  "MishpachaMap/0.1 (https://github.com/mor-a/mishpachamap; contact via Supabase)";

const RADIUS_M = 200;
const POLITENESS_MS = 250;
const SKIP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// License codes we consider safe to display with proper attribution. Anything
// else (fair use, "all rights reserved", unknown) is skipped — sparser
// coverage is better than a takedown notice.
const ALLOWED_LICENSE_PREFIXES = [
  "CC",       // CC BY, CC BY-SA, CC0
  "PD",       // Public Domain markers
  "GFDL",
  "Attribution",
];

function parseArgs(argv: string[]): Args {
  let type: string | null = null;
  let refresh = false;
  let limit: number | null = null;
  for (const a of argv) {
    if (a.startsWith("--type=")) type = a.slice("--type=".length);
    else if (a === "--refresh") refresh = true;
    else if (a.startsWith("--limit=")) limit = Number(a.slice("--limit=".length));
  }
  return { type, refresh, limit };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function wikiJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function geosearch(
  lang: "he" | "en",
  lat: number,
  lng: number,
): Promise<GeoSearchHit[]> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*` +
    `&action=query&list=geosearch&gscoord=${lat}|${lng}` +
    `&gsradius=${RADIUS_M}&gslimit=5`;
  type Resp = { query?: { geosearch?: GeoSearchHit[] } };
  const json = await wikiJson<Resp>(url);
  return json.query?.geosearch ?? [];
}

async function pageImageFor(
  lang: "he" | "en",
  pageid: number,
): Promise<PageImageInfo | null> {
  // Request both `original` and a 400px-wide thumbnail. The popup uses the
  // thumb (small, fast); we keep the original URL around as a fallback.
  const url =
    `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*` +
    `&action=query&pageids=${pageid}` +
    `&prop=pageimages|info&piprop=original|thumbnail|name&pithumbsize=400&inprop=url`;
  type Resp = { query?: { pages?: Record<string, PageImageInfo> } };
  const json = await wikiJson<Resp>(url);
  const page = json.query?.pages?.[String(pageid)];
  if (!page?.original?.source && !page?.thumbnail?.source) return null;
  return page;
}

async function commonsMeta(filename: string): Promise<CommonsImageMeta | null> {
  // `pageimage` from the Wikipedia API is a bare filename like "Park.jpg".
  // The Commons file page is at "File:<name>".
  const title = encodeURIComponent("File:" + filename);
  const url =
    `https://commons.wikimedia.org/w/api.php?format=json&origin=*` +
    `&action=query&titles=${title}` +
    `&prop=imageinfo&iiprop=url|extmetadata`;
  type Meta = { value?: string };
  type Page = {
    imageinfo?: Array<{
      url: string;
      extmetadata?: {
        LicenseShortName?: Meta;
        License?: Meta;
        LicenseUrl?: Meta;
        Artist?: Meta;
        ImageDescription?: Meta;
      };
    }>;
  };
  type Resp = { query?: { pages?: Record<string, Page> } };
  const json = await wikiJson<Resp>(url);
  const pages = json.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const ext = info.extmetadata ?? {};
  return {
    url: info.url,
    license: ext.LicenseShortName?.value ?? ext.License?.value ?? null,
    licenseUrl: ext.LicenseUrl?.value ?? null,
    artist: stripHtml(ext.Artist?.value ?? null),
    description: stripHtml(ext.ImageDescription?.value ?? null),
  };
}

function stripHtml(s: string | null): string | null {
  if (!s) return s;
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() || null;
}

function isAllowedLicense(license: string | null): boolean {
  if (!license) return false;
  const upper = license.toUpperCase();
  return ALLOWED_LICENSE_PREFIXES.some((p) => upper.startsWith(p.toUpperCase()));
}

type EnrichmentResult =
  | { ok: true; meta: Record<string, unknown> }
  | { ok: false; reason: string };

async function enrichPoi(p: POIRow): Promise<EnrichmentResult> {
  const [lng, lat] = p.point.coordinates as [number, number];
  for (const lang of ["he", "en"] as const) {
    const hits = await geosearch(lang, lat, lng);
    await sleep(POLITENESS_MS);
    if (hits.length === 0) continue;
    // Closest first (geosearch already sorts by distance, but be defensive).
    hits.sort((a, b) => a.dist - b.dist);
    for (const hit of hits) {
      const page = await pageImageFor(lang, hit.pageid);
      await sleep(POLITENESS_MS);
      if (!page?.pageimage || !page.original?.source) continue;
      const cm = await commonsMeta(page.pageimage);
      await sleep(POLITENESS_MS);
      if (!cm || !isAllowedLicense(cm.license)) {
        continue;
      }
      return {
        ok: true,
        meta: {
          ...p.meta,
          // Prefer the 400px thumbnail for popup speed; keep original as a
          // fallback so a future detail view could show high-res if useful.
          photo_url: page.thumbnail?.source ?? page.original?.source ?? cm.url,
          photo_url_full: page.original?.source ?? cm.url,
          photo_title: page.title,
          photo_page_url: page.fullurl,
          photo_source: `Wikipedia (${lang})`,
          photo_license: cm.license,
          photo_license_url: cm.licenseUrl,
          photo_artist: cm.artist,
          photo_checked_at: new Date().toISOString(),
        },
      };
    }
  }
  return { ok: false, reason: "no geo-tagged article with a CC lead image within 200m" };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let query = sb.from("pois_geojson").select("id, type, name_he, point, meta");
  if (args.type) query = query.eq("type", args.type);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load pois: ${error.message}`);
  let candidates = (data ?? []) as POIRow[];

  const cutoff = Date.now() - SKIP_WINDOW_MS;
  candidates = candidates.filter((p) => {
    if (!p.point) return false;
    const meta = p.meta ?? {};
    if (meta.photo_url) return false; // already has a photo
    if (args.refresh) return true;
    const checked = typeof meta.photo_checked_at === "string" ? Date.parse(meta.photo_checked_at) : NaN;
    return !Number.isFinite(checked) || checked < cutoff;
  });

  if (args.limit != null && args.limit > 0) {
    candidates = candidates.slice(0, args.limit);
  }

  console.log(`→ ${candidates.length} POIs to enrich${args.type ? ` (type=${args.type})` : ""}`);

  let hit = 0;
  let miss = 0;
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    process.stdout.write(`  [${i + 1}/${candidates.length}] ${p.type} · ${p.name_he ?? p.id} … `);
    try {
      const result = await enrichPoi(p);
      let newMeta: Record<string, unknown>;
      if (result.ok) {
        newMeta = result.meta;
        hit++;
        process.stdout.write(`✓ ${(result.meta.photo_license as string | null) ?? ""}\n`);
      } else {
        newMeta = { ...(p.meta ?? {}), photo_checked_at: new Date().toISOString(), photo_reason: result.reason };
        miss++;
        process.stdout.write(`– ${result.reason}\n`);
      }
      const { error: upErr } = await sb.from("pois").update({ meta: newMeta }).eq("id", p.id);
      if (upErr) console.error(`    update failed: ${upErr.message}`);
    } catch (e) {
      miss++;
      process.stdout.write(`! ${(e as Error).message}\n`);
    }
  }

  console.log(`done · ${hit} matched · ${miss} skipped/empty`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

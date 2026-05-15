import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.local.example to .env.local and fill in.",
  );
}

import { createClient } from "@supabase/supabase-js";

export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Modi'in-Maccabim-Re'ut bounding box (approximate WGS84).
 *
 * Modi'in proper sits roughly at 34.96-35.04°E, 31.85-31.93°N. Maccabim is a
 * separate eastern cluster around 35.04-35.07°E. Re'ut is a southern
 * neighborhood inside Modi'in proper (not a separate town, despite the
 * municipality name).
 */
export const MODIIN_BBOX = {
  south: 31.850,
  west: 34.960,
  north: 31.940,
  east: 35.075,
} as const;

/** PostgREST accepts EWKT (`SRID=4326;...`) for PostGIS geography columns. */
export function wktPoint([lng, lat]: [number, number]): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function wktPolygon(ring: [number, number][]): string {
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `SRID=4326;POLYGON((${coords}))`;
}

/**
 * Fetch JSON from the Overpass API. Overpass requires a proper User-Agent
 * header — without one it returns 406 Not Acceptable. Includes a retry on
 * 429/504 (rate-limit / gateway timeout, very common on Overpass).
 */
export async function fetchOverpass<T>(query: string): Promise<T> {
  const url = "https://overpass-api.de/api/interpreter";
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
    "User-Agent": "MishpachaMap/0.1 (https://github.com/mor-a/mishpachamap; contact via Supabase)",
  };
  const body = "data=" + encodeURIComponent(query);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers, body });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status === 504) {
      const wait = attempt * 5000;
      console.warn(`  Overpass ${res.status}; retrying in ${wait / 1000}s (attempt ${attempt}/3)…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Overpass: ${res.status} ${res.statusText}`);
  }
  throw new Error("Overpass: exhausted retries");
}

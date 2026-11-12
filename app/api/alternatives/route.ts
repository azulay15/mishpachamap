import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { crossCityIndex } from "@/lib/crossCity";
import { estimateMinutes, findCandidates, haversineKm, pickAlternatives, type Alternative } from "@/lib/alternatives";
import { marketPrice, type Deal, type RoomKey } from "@/lib/market";

export const runtime = "nodejs";

type Payload = {
  /** Current neighborhood (id + city id), when it is one we cover. */
  homeId?: string;
  homeCityId?: string;
  deal: Deal;
  rooms: RoomKey;
  /** What they pay now (NIS / month for rent, NIS for a purchase). */
  price: number;
  work: { lng: number; lat: number };
  maxMinutes: number;
};

/** Mapbox Matrix (driving) takes at most 25 coordinates per request. */
const MATRIX_MAX = 25;

/**
 * Routed driving minutes from each origin to the workplace, in one Matrix
 * request. Returns null when there is no token or the request fails — callers
 * then keep the straight-line estimate and say so.
 */
async function driveMinutes(origins: [number, number][], work: [number, number]): Promise<(number | null)[] | null> {
  const token = process.env.MAPBOX_SERVER_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || origins.length === 0) return null;
  const coords = [work, ...origins].map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const sources = origins.map((_, i) => i + 1).join(";");
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}` +
    `?sources=${sources}&destinations=0&annotations=duration&access_token=${token}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: string; durations?: (number | null)[][] };
    if (json.code !== "Ok" || !json.durations) return null;
    return json.durations.map((row) => (row[0] != null ? Math.round(row[0] / 60) : null));
  } catch {
    return null;
  }
}

/**
 * POST /api/alternatives — "more for less": neighborhoods across all cities
 * where a home of the same size costs less than the family pays now, within a
 * driving-time limit of their workplace.
 */
export async function POST(req: NextRequest) {
  const gate = rateLimit(req, "alternatives", { max: 20, windowMs: 60_000 });
  if (!gate.ok) return rateLimitResponse(gate);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const deal: Deal = body.deal === "buy" ? "buy" : "rent";
  const rooms = (["3", "4", "5", "all"] as RoomKey[]).includes(body.rooms) ? body.rooms : "4";
  const price = Number(body.price);
  const lng = Number(body.work?.lng);
  const lat = Number(body.work?.lat);
  const maxMinutes = Math.min(90, Math.max(10, Number(body.maxMinutes) || 30));
  if (!(price > 0) || !Number.isFinite(lng) || !Number.isFinite(lat) || lng < 34 || lng > 36 || lat < 29 || lat > 33.5) {
    return NextResponse.json({ error: "missing price or workplace" }, { status: 400 });
  }
  const work: [number, number] = [lng, lat];

  const index = crossCityIndex();
  const home = index.find((n) => n.id === body.homeId && n.cityId === body.homeCityId) ?? null;
  const cands = findCandidates(index, { home, homePrice: price, deal, rooms, work, maxMinutes });

  // Route the strongest candidates (+ home, for "your commute today").
  const routed = cands.slice(0, MATRIX_MAX - 1 - (home ? 1 : 0));
  const origins = [...routed.map((c) => c.nb.center), ...(home ? [home.center] : [])];
  const minutes = await driveMinutes(origins, work);
  let pool: Alternative[] = cands;
  let homeMinutes: number | null = home ? estimateMinutes(haversineKm(home.center, work)) : null;
  let estimated = true;
  if (minutes) {
    estimated = false;
    pool = routed.map((c, i) => ({ ...c, minutes: minutes[i], minutesEstimated: false })).filter((c) => c.minutes != null);
    if (home) homeMinutes = minutes[routed.length] ?? homeMinutes;
  }
  const picks = pickAlternatives(pool, { homePrice: price, maxMinutes });

  return NextResponse.json({
    home: home
      ? {
          id: home.id,
          he: home.he,
          cityHe: home.cityHe,
          sourcePrice: marketPrice(home, deal, rooms),
          schools: home.schools,
          green: home.green,
          safety: home.safety,
          minutes: homeMinutes,
        }
      : null,
    estimated,
    considered: cands.length,
    results: picks.map((a) => ({
      id: a.nb.id,
      he: a.nb.he,
      citySlug: a.nb.citySlug,
      cityHe: a.nb.cityHe,
      price: a.price,
      saving: a.saving,
      schools: a.nb.schools,
      schoolsDelta: a.schoolsDelta,
      green: a.nb.green,
      greenDelta: a.greenDelta,
      safety: a.nb.safety,
      safetyDelta: a.safetyDelta,
      minutes: a.minutes,
    })),
  });
}

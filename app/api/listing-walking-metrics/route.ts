import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "@/lib/supabase";
import { rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const CONTOUR_MINUTES = [5, 10, 15] as const;

type IsochroneResponse = {
  features: {
    properties: { contour: number };
    geometry: GeoJSON.Polygon;
  }[];
};

export type WalkingMetricsPayload = {
  listingId: string;
  pois_within: Record<string, Record<string, number>>;
  nearest_pois: Record<
    string,
    { id: string; name_he: string | null; meters: number }
  >;
  computed_at: string;
  cached: boolean;
};

async function fetchIsochrones(lng: number, lat: number): Promise<IsochroneResponse> {
  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}`,
  );
  url.searchParams.set("contours_minutes", CONTOUR_MINUTES.join(","));
  url.searchParams.set("polygons", "true");
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`mapbox isochrone ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as IsochroneResponse;
}

export async function POST(req: NextRequest) {
  const gate = rateLimit(req, "walking-metrics", { max: 30, windowMs: 60_000 });
  if (!gate.ok) return rateLimitResponse(gate);

  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "mapbox token not configured" },
      { status: 503 },
    );
  }

  let body: { listingId?: string };
  try {
    body = (await req.json()) as { listingId?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const listingId = String(body.listingId ?? "").trim();
  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const sb = adminSupabase();

  const { data: cached } = await sb
    .from("listing_walking_metrics_json")
    .select("listing_id, pois_within, nearest_pois, computed_at")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      listingId: cached.listing_id,
      pois_within: cached.pois_within,
      nearest_pois: cached.nearest_pois,
      computed_at: cached.computed_at,
      cached: true,
    } satisfies WalkingMetricsPayload);
  }

  const { data: listing, error: listingErr } = await sb
    .from("listings_geojson")
    .select("id, point")
    .eq("id", listingId)
    .maybeSingle();
  if (listingErr) {
    return NextResponse.json({ error: listingErr.message }, { status: 500 });
  }
  if (!listing) {
    return NextResponse.json({ error: "listing not found" }, { status: 404 });
  }
  const coords = (listing.point as GeoJSON.Point | null)?.coordinates;
  if (!coords || coords.length < 2) {
    return NextResponse.json(
      { error: "listing has no geo coordinates" },
      { status: 422 },
    );
  }
  const [lng, lat] = coords as [number, number];

  let iso: IsochroneResponse;
  try {
    iso = await fetchIsochrones(lng, lat);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 },
    );
  }

  const isoByMinute = new Map<number, GeoJSON.Polygon>();
  for (const f of iso.features) {
    isoByMinute.set(f.properties.contour, f.geometry);
  }
  const iso5 = isoByMinute.get(5);
  const iso10 = isoByMinute.get(10);
  const iso15 = isoByMinute.get(15);
  if (!iso5 || !iso10 || !iso15) {
    return NextResponse.json(
      { error: "isochrone response missing contours" },
      { status: 502 },
    );
  }

  const { error: rpcErr } = await sb.rpc("upsert_listing_walking_metrics", {
    p_listing_id: listingId,
    p_iso_5: JSON.stringify(iso5),
    p_iso_10: JSON.stringify(iso10),
    p_iso_15: JSON.stringify(iso15),
    p_lng: lng,
    p_lat: lat,
  });
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const { data: fresh, error: readErr } = await sb
    .from("listing_walking_metrics_json")
    .select("listing_id, pois_within, nearest_pois, computed_at")
    .eq("listing_id", listingId)
    .single();
  if (readErr || !fresh) {
    return NextResponse.json(
      { error: readErr?.message ?? "failed to read back metrics" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    listingId: fresh.listing_id,
    pois_within: fresh.pois_within,
    nearest_pois: fresh.nearest_pois,
    computed_at: fresh.computed_at,
    cached: false,
  } satisfies WalkingMetricsPayload);
}

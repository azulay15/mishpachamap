import { ImageResponse } from "next/og";
import { getCity } from "@/lib/cities";
import { loadNeighborhoodFeatures } from "@/lib/geoData";

/**
 * Link-preview image (WhatsApp / Open Graph) for a shared neighborhood:
 * the city's real polygons with the shared one highlighted.
 *
 * `GET /api/og?city=<slug>&n=<neighborhood id>`
 *
 * Text is Latin-only on purpose — the image renderer (Satori) has no RTL
 * shaping, so Hebrew would come out reversed. The Hebrew name travels in the
 * page's og:title / og:description instead, which chat apps show beside it.
 */
const W = 1200;
const H = 630;
const MAP = { x: 560, y: 45, w: 590, h: 540 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = getCity(searchParams.get("city") ?? "");
  if (!city || city.status !== "live") return new Response("Unknown city", { status: 404 });

  const features = loadNeighborhoodFeatures(city).features;
  const selectedId = searchParams.get("n");
  const selected = features.find((f) => f.properties.id === selectedId);

  // Equirectangular projection fitted into the map box.
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features) {
    for (const [lng, lat] of f.geometry.coordinates[0] ?? []) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * kx || 1;
  const spanY = maxLat - minLat || 1;
  const scale = Math.min(MAP.w / spanX, MAP.h / spanY);
  const ox = MAP.x + (MAP.w - spanX * scale) / 2;
  const oy = MAP.y + (MAP.h - spanY * scale) / 2;
  const path = (ring: GeoJSON.Position[]) =>
    ring
      .map(([lng, lat], i) => `${i === 0 ? "M" : "L"}${(ox + (lng - minLng) * kx * scale).toFixed(1)} ${(oy + (maxLat - lat) * scale).toFixed(1)}`)
      .join("") + "Z";

  const title = selected?.properties.name_en?.trim() || city.name_en;
  const subtitle = selected && title !== city.name_en ? city.name_en : "Neighborhood map for families";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#EDF3EE" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
          {features.map((f) => (
            <path
              key={f.properties.id}
              d={path(f.geometry.coordinates[0] ?? [])}
              fill={f === selected ? "#1F7A45" : "#BADFC3"}
              stroke={f === selected ? "#EF6A1B" : "#FFFFFF"}
              strokeWidth={f === selected ? 6 : 2}
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 540, height: "100%", padding: "56px 0 56px 64px" }}>
          <svg width="96" height="96" viewBox="0 0 48 48" fill="none">
            <path d="M8 41q16-6 32 0" stroke="#1F7A45" strokeWidth="3" strokeLinecap="round" />
            <path d="M24 38V19" stroke="#1F7A45" strokeWidth="3" strokeLinecap="round" />
            <path d="M23.5 31C14 31 8.5 25 8.5 17c8.5 0 15 5.5 15 14z" fill="#1F7A45" />
            <path d="M24.5 26c9.5 0 15-6 15-14-8.5 0-15 5.5-15 14z" fill="#1F7A45" />
            <circle cx="24" cy="12.5" r="4.6" fill="#EF6A1B" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: title.length > 18 ? 56 : 72, fontWeight: 700, color: "#14231A", lineHeight: 1.05 }}>{title}</div>
            <div style={{ fontSize: 32, color: "#4A5A50", marginTop: 16 }}>{subtitle}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}

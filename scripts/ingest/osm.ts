/**
 * Fetch POIs in Modi'in from the OpenStreetMap Overpass API and upsert into `pois`.
 *
 * Categories are mapped onto our LayerId taxonomy:
 *   amenity=school         → schools (separate ingest writes them to `schools`)
 *   amenity=kindergarten   → preschool
 *   amenity=place_of_worship/community_centre → community
 *   leisure=park/playground → park
 *   shop=supermarket/convenience/bakery → shop
 *   public_transport=station / railway=station → transit
 */
import { sb, MODIIN_BBOX, wktPoint, fetchOverpass } from "./_env";

const QUERY = `
[out:json][timeout:30];
(
  node["amenity"="kindergarten"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["amenity"="place_of_worship"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["amenity"="community_centre"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["leisure"="park"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["leisure"="playground"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["shop"~"^(supermarket|convenience|bakery)$"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["public_transport"~"^(station|stop_position)$"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
  node["railway"="station"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
);
out body;
`;

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

function classify(tags: Record<string, string> = {}): string | null {
  if (tags.amenity === "kindergarten") return "preschool";
  if (tags.amenity === "place_of_worship" || tags.amenity === "community_centre") return "community";
  if (tags.leisure === "park" || tags.leisure === "playground") return "park";
  if (tags.shop) return "shop";
  if (tags.railway === "station" || tags.public_transport === "station" || tags.public_transport === "stop_position")
    return "transit";
  return null;
}

async function main() {
  console.log("→ Fetching Modi'in POIs from Overpass…");
  const json = await fetchOverpass<{ elements: OverpassNode[] }>(QUERY);
  console.log(`  got ${json.elements.length} raw nodes`);

  const rows = json.elements
    .map((n) => {
      const type = classify(n.tags);
      if (!type) return null;
      return {
        id: `osm-${n.id}`,
        type,
        name_he: n.tags?.["name:he"] ?? n.tags?.name ?? null,
        point: wktPoint([n.lon, n.lat]),
        meta: n.tags ?? {},
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`→ Upserting ${rows.length} POIs…`);
  // Chunk to keep payload size reasonable.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("pois").upsert(slice);
    if (error) {
      console.error("  upsert error:", error.message);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`✓ done (${rows.length} POIs)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

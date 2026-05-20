/**
 * Seed synthetic listings — 3-5 per Modi'in / Maccabim / Re'ut neighborhood,
 * so the right rail shows real-looking content when you click a polygon.
 *
 * Tagged `source='synthetic-v1'`. To remove later:
 *   delete from listings where source = 'synthetic-v1';
 *
 * TODO(post-V1): replace with a real Yad2 / Madlan scraper.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bbox, booleanPointInPolygon, centroid } from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { sb, wktPoint } from "./_env";

/** Polygon lookup by neighborhood id, sourced from the same static file the
 *  frontend uses (`public/neighborhoods.geo.json`). Ensures the seeded points
 *  fall inside the polygons actually rendered on the map. */
function loadPolygons(): Map<string, Feature<Polygon | MultiPolygon>> {
  const path = resolve(process.cwd(), "public", "neighborhoods.geo.json");
  const raw = readFileSync(path, "utf8");
  const fc = JSON.parse(raw) as { features: Feature<Polygon | MultiPolygon>[] };
  const map = new Map<string, Feature<Polygon | MultiPolygon>>();
  for (const f of fc.features) {
    const id = (f.properties as { id?: string } | null)?.id;
    if (id) map.set(id, f);
  }
  return map;
}

/** Rejection-sample a random point inside a polygon. Falls back to the
 *  centroid after 50 misses (rare for our reasonably convex shapes). */
function randomPointInPolygon(
  feature: Feature<Polygon | MultiPolygon>,
): [number, number] {
  const [minX, minY, maxX, maxY] = bbox(feature);
  for (let i = 0; i < 50; i++) {
    const lng = minX + Math.random() * (maxX - minX);
    const lat = minY + Math.random() * (maxY - minY);
    if (booleanPointInPolygon([lng, lat], feature)) return [lng, lat];
  }
  const c = centroid(feature).geometry.coordinates as [number, number];
  return c;
}

const POLYGONS = loadPolygons();

type Profile = {
  id: string;
  name_he: string;
  avgPpm: number;
  medianRooms: number;
  streets: string[];
};

const PROFILES: Profile[] = [
  { id: "hareut",     name_he: "הרעות",     avgPpm: 31000, medianRooms: 5, streets: ["ההגנה", "ירדן", "התחיה", "המייסדים"] },
  { id: "hamakkabim", name_he: "המכבים",   avgPpm: 36000, medianRooms: 6, streets: ["יהודה המכבי", "החשמונאים", "מתתיהו"] },
  { id: "masuah",     name_he: "משואה",     avgPpm: 33000, medianRooms: 5, streets: ["ההר", "המשואות", "מצדה", "גמלא"] },
  { id: "avneichen",  name_he: "אבני חן",   avgPpm: 28500, medianRooms: 4, streets: ["ספיר", "יהלום", "אבן חן", "פנינה"] },
  { id: "nofim",      name_he: "נופים",     avgPpm: 28700, medianRooms: 4, streets: ["הרקפת", "הכלנית", "הסביון", "הנרקיס"] },
  { id: "haprachim",  name_he: "הפרחים",   avgPpm: 29000, medianRooms: 4, streets: ["חרצית", "מירומי", "תפוח", "כלנית"] },
  { id: "hanechalim", name_he: "הנחלים",   avgPpm: 27500, medianRooms: 4, streets: ["נחל אלכסנדר", "נחל איילון", "נחל קישון"] },
  { id: "hakramim",   name_he: "הכרמים",   avgPpm: 30100, medianRooms: 5, streets: ["המייסדים", "הגפן", "הזית", "התות"] },
  { id: "hashvatim",  name_he: "השבטים",   avgPpm: 35000, medianRooms: 6, streets: ["ראובן", "שמעון", "לוי", "יהודה"] },
  { id: "moriah",     name_he: "מוריה",     avgPpm: 34200, medianRooms: 5, streets: ["ההגנה", "מסילת ישרים", "הרב קוק", "האבות"] },
  { id: "hanevim",    name_he: "הנביאים",   avgPpm: 28000, medianRooms: 4, streets: ["ישעיהו", "ירמיהו", "יחזקאל", "עמוס"] },
  { id: "hameginim",  name_he: "המגינים",   avgPpm: 27000, medianRooms: 4, streets: ["החרגול", "השלום", "בני ברית"] },
  { id: "hatsiporim", name_he: "הציפורים", avgPpm: 32500, medianRooms: 5, streets: ["דרור", "אדום החזה", "סנונית", "תור"] },
  { id: "moreshet",   name_he: "מורשת",     avgPpm: 30500, medianRooms: 5, streets: ["המורשת", "ההגנה", "מסילת ישרים", "הציונות"] },
];

const STATUS_POOL: (string | null)[] = [
  null,
  null,
  "חדש בשוק",
  "ירידת מחיר",
  "פתוח להצעות",
];

function gaussian(): number {
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randInt(min: number, maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function generateRow(p: Profile, i: number) {
  const rooms = Math.max(3, Math.min(7, p.medianRooms + randInt(-1, 1)));
  const sqm = Math.round(rooms * (28 + Math.random() * 6));
  const ppm = Math.round(p.avgPpm * (1 + gaussian() * 0.08));
  const price = ppm * sqm;
  const hasGarden = Math.random() < (rooms >= 5 ? 0.5 : 0.2);
  const garden = hasGarden ? randInt(20, 90) : null;
  const floor = randInt(0, 6);
  const polygon = POLYGONS.get(p.id);
  const point = polygon ? wktPoint(randomPointInPolygon(polygon)) : null;
  return {
    id: `mock-${p.id}-${i}`,
    neighborhood: p.id,
    address: `${pick(p.streets)} ${randInt(1, 80)}, ${p.name_he}`,
    point,
    price_nis: price,
    price_per_m2: ppm,
    rooms,
    sqm,
    garden_sqm: garden,
    parking: rooms >= 5 ? randInt(1, 2) : 1,
    storage: Math.random() < 0.7,
    elevator: floor >= 2 ? Math.random() < 0.85 : false,
    floor_label: floor === 0 ? "קרקע" : `${floor} מתוך ${floor + randInt(0, 3)}`,
    year_built: randInt(1998, 2024),
    status_he: pick(STATUS_POOL),
    days_on_market: randInt(2, 60),
    images_count: randInt(8, 28),
    source: "synthetic-v1",
  };
}

async function main() {
  // Wipe prior synthetic batch so re-runs don't accumulate.
  const { error: deleteErr } = await sb.from("listings").delete().eq("source", "synthetic-v1");
  if (deleteErr) {
    console.error("cleanup error:", deleteErr.message);
    process.exitCode = 1;
    return;
  }

  const rows: ReturnType<typeof generateRow>[] = [];
  for (const p of PROFILES) {
    const count = randInt(3, 5);
    for (let i = 0; i < count; i++) rows.push(generateRow(p, i));
  }

  console.log(`→ inserting ${rows.length} synthetic listings…`);
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("listings").insert(slice);
    if (error) {
      console.error("insert error:", error.message);
      process.exitCode = 1;
      return;
    }
  }

  for (const p of PROFILES) {
    const n = rows.filter((r) => r.neighborhood === p.id).length;
    console.log(`  ${p.id}: ${n} listings`);
  }
  console.log(`✓ done (${rows.length} listings)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

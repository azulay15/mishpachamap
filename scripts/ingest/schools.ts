/**
 * Ingest schools in Modi'in from the OSM Overpass API as a starting point,
 * then enrich with Meitzav (משרד החינוך) ratings where available.
 *
 * V1 implementation: pull amenity=school nodes from OSM. Meitzav scores left
 * NULL — wire up the Education Ministry CSV import in a follow-up.
 *
 * TODO(post-V1): integrate the official school-rankings export from
 * data.gov.il (resource: "מאגר מוסדות חינוך משרד החינוך") and join by school
 * name + city.
 */
import { sb, MODIIN_BBOX, wktPoint, fetchOverpass } from "./_env";

const QUERY = `
[out:json][timeout:30];
(
  node["amenity"="school"](${MODIIN_BBOX.south},${MODIIN_BBOX.west},${MODIIN_BBOX.north},${MODIIN_BBOX.east});
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

function classifyLevel(tags: Record<string, string> = {}): string {
  const isced = tags["isced:level"];
  if (isced?.startsWith("1")) return "elementary";
  if (isced?.startsWith("2")) return "middle";
  if (isced?.startsWith("3")) return "high";
  if (tags.school === "primary") return "elementary";
  if (tags.school === "secondary") return "middle";
  return "elementary";
}

/**
 * Best-effort orientation classification from OSM tags. Israeli school
 * orientations map roughly:
 *   - ממלכתי   = general state secular
 *   - ממ"ד     = state religious (mamlachti dati)
 *   - חרדי    = haredi (independent stream or "Maayan Ha'chinuch Hatorani")
 * OSM doesn't carry these directly, but `religion=jewish` + `denomination`
 * (orthodox / haredi) is the usual hint. NULL when we can't tell — the UI
 * just hides the field rather than guess.
 */
function classifyOrientation(tags: Record<string, string> = {}): string | null {
  const religion = tags.religion ?? tags["school:religion"];
  const denom = (tags.denomination ?? tags["school:denomination"] ?? "").toLowerCase();
  if (!religion) return null;
  if (religion !== "jewish") return null;
  if (denom.includes("haredi") || denom.includes("orthodox-haredi")) return "חרדי";
  if (denom.includes("orthodox") || denom.includes("religious")) return "ממ\"ד";
  return null;
}

async function main() {
  console.log("→ Fetching Modi'in schools from Overpass…");
  const json = await fetchOverpass<{ elements: OverpassNode[] }>(QUERY);

  const rows = json.elements.map((n) => ({
    id: `osm-${n.id}`,
    name_he: n.tags?.["name:he"] ?? n.tags?.name ?? "בית ספר ללא שם",
    point: wktPoint([n.lon, n.lat]),
    level: classifyLevel(n.tags),
    meitzav_score: null,
    rating_year: null,
    orientation: classifyOrientation(n.tags),
    website_url: n.tags?.website ?? n.tags?.["contact:website"] ?? null,
  }));

  console.log(`→ Upserting ${rows.length} schools…`);
  const { error } = await sb.from("schools").upsert(rows);
  if (error) {
    console.error("  upsert error:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ done (${rows.length} schools, Meitzav scores left NULL — wire up in a follow-up)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

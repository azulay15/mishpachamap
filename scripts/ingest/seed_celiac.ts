/**
 * Seed a hand-curated Celiac-Friendly venue list for Modi'in.
 *
 * V1: synthetic data with plausible names, scattered across central Modi'in.
 * Each entry tagged `meta.gf_status` so we can later filter strict vs lenient.
 *
 * TODO(post-V1): curate against:
 *   - האגודה הישראלית לצליאק (Israeli Celiac Association) directory
 *   - Google Maps "gluten free" search export
 *   - User submissions
 */
import { sb, wktPoint } from "./_env";

type Venue = {
  id: string;
  name_he: string;
  pos: [number, number]; // [lng, lat]
  kind: "bakery" | "restaurant" | "grocery";
  gf_status: "dedicated" | "menu" | "aisle";
};

// Plausible Modi'in GF venues. Coordinates scattered across known commercial
// strips (Azrieli mall area, Buchman commercial center, Hakramim square, etc).
const VENUES: Venue[] = [
  { id: "celiac-1",  name_he: "Free Slice Pizza מודיעין",       pos: [35.014, 31.904], kind: "restaurant", gf_status: "dedicated" },
  { id: "celiac-2",  name_he: "מאפיית הגלוטן החופשית",            pos: [35.005, 31.910], kind: "bakery",     gf_status: "dedicated" },
  { id: "celiac-3",  name_he: "Susu Sushi - תפריט נטול גלוטן",    pos: [35.020, 31.895], kind: "restaurant", gf_status: "menu" },
  { id: "celiac-4",  name_he: "שופרסל דיל מודיעין · מדף מיוחד",   pos: [35.017, 31.907], kind: "grocery",    gf_status: "aisle" },
  { id: "celiac-5",  name_he: "מאפיה שמחה ובריא · אגף ללא גלוטן", pos: [34.997, 31.913], kind: "bakery",     gf_status: "aisle" },
  { id: "celiac-6",  name_he: "פיצה האט בוכמן · תפריט GF",        pos: [34.982, 31.927], kind: "restaurant", gf_status: "menu" },
  { id: "celiac-7",  name_he: "טבע נטורל · חנות בריאות הכרמים",   pos: [35.010, 31.928], kind: "grocery",    gf_status: "dedicated" },
  { id: "celiac-8",  name_he: "Café Café מודיעין · תפריט GF",     pos: [35.014, 31.905], kind: "restaurant", gf_status: "menu" },
  { id: "celiac-9",  name_he: "מאפיית רוטשטיין מוריה · מדף נפרד", pos: [35.020, 31.860], kind: "bakery",     gf_status: "aisle" },
  { id: "celiac-10", name_he: "Sano Health · ללא גלוטן",          pos: [34.978, 31.925], kind: "grocery",    gf_status: "aisle" },
  { id: "celiac-11", name_he: "אמיתי המאפה הכרמים · אזור ייעודי", pos: [35.012, 31.926], kind: "bakery",     gf_status: "aisle" },
  { id: "celiac-12", name_he: "פלאפל הגליל · GF certified",       pos: [34.999, 31.908], kind: "restaurant", gf_status: "dedicated" },
];

async function main() {
  // Wipe prior synthetic celiac entries so re-runs don't pile up.
  const { error: deleteErr } = await sb
    .from("pois")
    .delete()
    .eq("type", "celiac")
    .like("id", "celiac-%");
  if (deleteErr && !deleteErr.message.includes("0 rows")) {
    console.warn("cleanup:", deleteErr.message);
  }

  const rows = VENUES.map((v) => ({
    id: v.id,
    type: "celiac",
    name_he: v.name_he,
    point: wktPoint(v.pos),
    meta: { kind: v.kind, gf_status: v.gf_status, source: "synthetic-v1" },
  }));

  console.log(`→ upserting ${rows.length} celiac venues…`);
  const { error } = await sb.from("pois").upsert(rows);
  if (error) {
    console.error("✗", error.message);
    process.exitCode = 1;
    return;
  }
  for (const v of VENUES) {
    console.log(`  ✓ ${v.id} — ${v.name_he} (${v.gf_status})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Seed the 13 Modi'in / Maccabim / Re'ut neighborhoods.
 *
 * Each polygon here is a HAND-ALIGNED RECTANGLE in WGS84, laid out roughly
 * to match the city's real geography (west → east, south → north). They are
 * V1 placeholders for the demo — the real boundaries come from CBS statistical
 * areas in a follow-up ingest.
 *
 * `aliases` are critical for free-text search: residents call Avnei Chen
 * "Kaiser", HaShvatim "Buchman North", and so on. The matcher in the AI rail
 * + the search bar both key off this array.
 *
 * Cleanup: any existing row in `neighborhoods` whose id is not in this list
 * is deleted (after dropping its dependent listings / transactions / metrics).
 */
import { sb, wktPoint, wktPolygon } from "./_env";

type Seed = {
  id: string;
  name_he: string;
  name_en: string;
  family_label: string;
  summary_he: string;
  tags: string[];
  aliases: string[];
  ring: [number, number][];
};

// Positions traced from the official municipal map at
// `Pick a neighborhood/...` (see chat). Each rectangle is the bounding box of
// the real (irregular) polygon as drawn on that map. V1 approximation; replace
// with CBS statistical areas later.
const SEEDS: Seed[] = [
  {
    id: "hakramim",
    name_he: "הכרמים",
    name_en: "HaKramim",
    family_label: "משפחתית, מעורב, שקטה",
    summary_he:
      "השכונה הצפונית; מאופיינת ברחובות מעגליים, פארק מרכזי גדול (פארק הכרמים) ומרכז מסחרי מודרני. מושלמת למשפחות המחפשות שקט וקהילה צעירה.",
    tags: ["משפחתית", "שקט", "פארק מרכזי"],
    aliases: ["כרמים", "Kramim"],
    ring: rect(35.000, 31.920, 35.030, 31.935),
  },
  {
    id: "hanevim",
    name_he: "הנביאים",
    name_en: "HaNeviim",
    family_label: "חילונית, נגישה, בניה מגוונת",
    summary_he:
      "שמשוני צפון; תמהיל דירות רחב החל מ-3 חדרים ועד פנטהאוזים. מאופיינת בקרבה לעמקים ירוקים, גני ילדים בשפע ומרכז מסחרי שכונתי מרכזי.",
    tags: ["חילוני", "משפרי דיור", "גני ילדים"],
    aliases: ["שמשוני צפון", "שמשוני", "Shimshoni North", "Shimshoni Tzafon", "Shimshoni"],
    ring: rect(34.978, 31.918, 35.000, 31.935),
  },
  {
    id: "hameginim",
    name_he: "המגינים",
    name_en: "HaMeginim",
    family_label: "משפחתית, מגוונת, פארקים",
    summary_he:
      "שמשוני דרום; ידועה בפארקים הייחודיים שלה (כמו פארק החרגול) ובריכוז גבוה של בתי ספר. מציעה אווירה קהילתית חמה ונגישות טובה לכל חלקי העיר.",
    tags: ["פארקים", "בתי ספר", "מגוון"],
    aliases: ["שמשוני דרום", "שמשוני", "Shimshoni South", "Shimshoni Darom", "Shimshoni"],
    ring: rect(34.972, 31.900, 34.995, 31.918),
  },
  {
    id: "haprachim",
    name_he: "הפרחים",
    name_en: "HaPrachim",
    family_label: "מרכזית, חילונית, נגישה",
    summary_he:
      "הלב של העיר; שילוב של בניה ותיקה עם מגדלים מודרניים. מרחק הליכה מהעירייה, הקניון ומרכזי מסחר, אידיאלית למשפחות שרוצות הכל בטווח הליכה.",
    tags: ["מרכזית", "הליכתי", "מסעדות"],
    aliases: ["מירומי", "Miromi"],
    ring: rect(34.995, 31.900, 35.020, 31.918),
  },
  {
    id: "avneichen",
    name_he: "אבני חן",
    name_en: "Avnei Chen",
    family_label: "צעירה, תוססת, אורבנית",
    summary_he:
      "קייזר; שכונה \"חיה\" עם ריכוז גבוה של משפחות צעירות. צמודה לפארק ענבה ולרכבת, וכוללת מרכזים מסחריים שכונתיים פעילים מאוד לאורך כל השבוע.",
    tags: ["צעירה", "אורבני", "ליד הרכבת"],
    aliases: ["קייזר", "Kaiser"],
    ring: rect(34.965, 31.882, 34.990, 31.902),
  },
  {
    id: "hanechalim",
    name_he: "הנחלים",
    name_en: "HaNechalim",
    family_label: "ותיקה, ירוקה, משפחתית",
    summary_he:
      "שכונת ספדיה; ידועה בצמחייה בוגרת ופארקים רחבים לאורך העמקים. מציעה תחושה קהילתית יציבה ותמהיל דירות מגוון בבנייה נמוכה ונגישה.",
    tags: ["ירוקה", "ותיקה", "משפחתית"],
    aliases: ["ספדיה", "שכונת ספדיה", "Safdie", "Sefadia"],
    ring: rect(34.995, 31.885, 35.025, 31.902),
  },
  {
    id: "masuah",
    name_he: "משואה",
    name_en: "Masuah",
    family_label: "אנגלו-סכסית, נוף פתוח, דתית-לאומית",
    summary_he:
      "גבעת C; ממוקמת על נקודה גבוהה עם נוף מרהיב. קהילה מגובשת של עולים, בתי כנסת פעילים ומוסדות חינוך שנחשבים מהמובילים בעיר.",
    tags: ["אנגלו-סכסים", "נוף", "דתי-לאומי"],
    aliases: ["גבעת C", "Givat C", "גבעת סי"],
    ring: rect(35.020, 31.878, 35.040, 31.898),
  },
  {
    id: "hareut",
    name_he: "הרעות",
    name_en: "HaReut",
    family_label: "קהילתית, בטחונית, כפרית",
    summary_he:
      "רעות; הוקמה עבור אנשי כוחות הבטחון. מאופיינת בבניה נמוכה, איכות חיים גבוהה מאוד ומרכזים קהילתיים וספורטיביים פעילים.",
    tags: ["כפרית", "קהילתית", "ותיקה"],
    aliases: ["רעות", "Re'ut", "Reut"],
    ring: rect(34.998, 31.864, 35.025, 31.882),
  },
  {
    id: "hashvatim",
    name_he: "השבטים",
    name_en: "HaShvatim",
    family_label: "יוקרתית, בניה נמוכה, מעורב",
    summary_he:
      "בוכמן צפון; מאופיינת ברחובות הולנדיים רחבים, צמודי קרקע וגינות מטופחות. מציעה שקט פרברי, קרבה לטבע וליציאה מהעיר לכיוון ירושלים.",
    tags: ["יוקרה", "צמודי קרקע", "שקט"],
    aliases: ["בוכמן צפון", "בוכמן", "Buchman North", "Buchman Tzafon", "Buchman"],
    ring: rect(34.970, 31.862, 34.998, 31.882),
  },
  {
    id: "moriah",
    name_he: "מוריה",
    name_en: "Moriah",
    family_label: "יוקרתית, דתית-לאומית, בניה נמוכה",
    summary_he:
      "בוכמן דרום; מהשכונות המבוקשות ביותר בזכות צמודי קרקע יוקרתיים, אווירה קהילתית חזקה ומוסדות חינוך איכותיים של המגזר הדתי-לאומי.",
    tags: ["יוקרה", "דתי-לאומי", "צמודי קרקע"],
    aliases: ["בוכמן דרום", "בוכמן", "Buchman South", "Buchman Darom", "Buchman"],
    ring: rect(35.000, 31.852, 35.040, 31.870),
  },
  {
    id: "nofim",
    name_he: "נופים",
    name_en: "Nofim",
    family_label: "מודרנית, נוף למערב, צעירה",
    summary_he:
      "נבנתה על רכס המשקיף לשפלה; מאופיינת בתכנון מודרני, מוסדות חינוך חדשים וטכנולוגיים וגישה נוחה לצירי תנועה מרכזיים מחוץ לעיר.",
    tags: ["נוף", "חדש", "טכנולוגי"],
    aliases: [],
    ring: rect(34.962, 31.902, 34.978, 31.920),
  },
  {
    id: "hatsiporim",
    name_he: "הציפורים",
    name_en: "HaTsiporim",
    family_label: "חדשה, בוטיקית, אסטרטגית",
    summary_he:
      "השכונה החדשה ביותר בעמקים; בניה חדישה בסטנדרט גבוה. אידיאלית ליוממים (Commuters) בזכות יציאה ישירה לכביש 431 וקרבה לטיילת נחל ענבה.",
    tags: ["חדש", "בוטיק", "ליד 431"],
    aliases: ["ציפורים", "Tsiporim", "Tziporim"],
    ring: rect(35.030, 31.860, 35.050, 31.880),
  },
  {
    id: "hamakkabim",
    name_he: "המכבים",
    name_en: "HaMakkabim",
    family_label: "כפרית, וותיקה, יוקרתית",
    summary_he:
      "מכבים; רובע המאופיין בבתים פרטיים גדולים על מגרשים רחבים, הרבה צמחייה ותחושת יישוב קהילתי נפרד בתוך העיר.",
    tags: ["כפרית", "יוקרה", "בתים פרטיים"],
    aliases: ["מכבים", "Maccabim"],
    ring: rect(35.045, 31.918, 35.072, 31.938),
  },
];

function rect(west: number, south: number, east: number, north: number): [number, number][] {
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function centroid(ring: [number, number][]): [number, number] {
  const pts = ring.slice(0, -1);
  const sx = pts.reduce((s, [x]) => s + x, 0);
  const sy = pts.reduce((s, [, y]) => s + y, 0);
  return [sx / pts.length, sy / pts.length];
}

async function main() {
  const validIds = SEEDS.map((s) => s.id);

  // Step 1 — wipe orphan dependent rows so we can delete orphan neighborhoods.
  console.log("→ cleaning up orphan rows from prior runs…");
  for (const table of ["listings", "transactions", "neighborhood_metrics"]) {
    const { error } = await sb.from(table).delete().not("neighborhood", "in", `(${validIds.map((id) => `"${id}"`).join(",")})`);
    if (error && !error.message.includes("0 rows")) {
      console.warn(`  ${table}: ${error.message}`);
    }
  }
  const { error: orphanErr } = await sb
    .from("neighborhoods")
    .delete()
    .not("id", "in", `(${validIds.map((id) => `"${id}"`).join(",")})`);
  if (orphanErr) console.warn(`  neighborhoods: ${orphanErr.message}`);

  // Step 2 — upsert the 13 canonical neighborhoods.
  console.log(`→ upserting ${SEEDS.length} neighborhoods…`);
  for (const s of SEEDS) {
    const polygon = wktPolygon(s.ring);
    const center = wktPoint(centroid(s.ring));

    const { error } = await sb.from("neighborhoods").upsert({
      id: s.id,
      name_he: s.name_he,
      name_en: s.name_en,
      polygon,
      center,
      family_label: s.family_label,
      summary_he: s.summary_he,
      tags: s.tags,
      aliases: s.aliases,
    });

    if (error) {
      console.error(`✗ ${s.id}: ${error.message}`);
      process.exitCode = 1;
    } else {
      const aliasNote = s.aliases.length > 0 ? `  ↳ aliases: ${s.aliases.join(", ")}` : "";
      console.log(`✓ ${s.id} (${s.name_he})${aliasNote ? "\n" + aliasNote : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

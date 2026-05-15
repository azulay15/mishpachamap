/**
 * Seed the 13 Modi'in / Maccabim / Re'ut neighborhoods.
 *
 * Architecture (per chat 2026-05-15):
 *   - Polygons come from the static file `public/neighborhoods.geo.json`.
 *   - Metadata (family label, summary, aliases) lives in this file's SEEDS
 *     array and is upserted into the `neighborhoods` table.
 *   - The DB still stores the polygon/center for PostGIS queries
 *     (schools_within_meters, etc.), but the GeoJSON file is the source of
 *     truth — re-run seed any time you replace the file.
 *
 * `aliases` are critical for free-text search: residents call Avnei Chen
 * "Kaiser", HaShvatim "Buchman North", and so on. The matcher in the AI rail
 * + the search bar both key off this array.
 *
 * Cleanup: any existing row in `neighborhoods` whose id is not in this list
 * is deleted (after dropping its dependent listings / transactions / metrics).
 */
import { sb, wktPoint, wktPolygon } from "./_env";
import { loadNeighborhoodFeatures, centroidOf } from "../../lib/geoData";

type SeedMeta = {
  id: string;
  family_label: string;
  summary_he: string;
  tags: string[];
  aliases: string[];
};

const SEED_META: SeedMeta[] = [
  {
    id: "hakramim",
    family_label: "משפחתית, מעורב, שקטה",
    summary_he:
      "השכונה הצפונית; מאופיינת ברחובות מעגליים, פארק מרכזי גדול (פארק הכרמים) ומרכז מסחרי מודרני. מושלמת למשפחות המחפשות שקט וקהילה צעירה.",
    tags: ["משפחתית", "שקט", "פארק מרכזי"],
    aliases: ["כרמים", "Kramim"],
  },
  {
    id: "hanevim",
    family_label: "חילונית, נגישה, בניה מגוונת",
    summary_he:
      "שמשוני צפון; תמהיל דירות רחב החל מ-3 חדרים ועד פנטהאוזים. מאופיינת בקרבה לעמקים ירוקים, גני ילדים בשפע ומרכז מסחרי שכונתי מרכזי.",
    tags: ["חילוני", "משפרי דיור", "גני ילדים"],
    aliases: ["שמשוני צפון", "שמשוני", "Shimshoni North", "Shimshoni Tzafon", "Shimshoni"],
  },
  {
    id: "hameginim",
    family_label: "משפחתית, מגוונת, פארקים",
    summary_he:
      "שמשוני דרום; ידועה בפארקים הייחודיים שלה (כמו פארק החרגול) ובריכוז גבוה של בתי ספר. מציעה אווירה קהילתית חמה ונגישות טובה לכל חלקי העיר.",
    tags: ["פארקים", "בתי ספר", "מגוון"],
    aliases: ["שמשוני דרום", "שמשוני", "Shimshoni South", "Shimshoni Darom", "Shimshoni"],
  },
  {
    id: "haprachim",
    family_label: "מרכזית, חילונית, נגישה",
    summary_he:
      "הלב של העיר; שילוב של בניה ותיקה עם מגדלים מודרניים. מרחק הליכה מהעירייה, הקניון ומרכזי מסחר, אידיאלית למשפחות שרוצות הכל בטווח הליכה.",
    tags: ["מרכזית", "הליכתי", "מסעדות"],
    aliases: ["מירומי", "Miromi"],
  },
  {
    id: "avneichen",
    family_label: "צעירה, תוססת, אורבנית",
    summary_he:
      "קייזר; שכונה \"חיה\" עם ריכוז גבוה של משפחות צעירות. צמודה לפארק ענבה ולרכבת, וכוללת מרכזים מסחריים שכונתיים פעילים מאוד לאורך כל השבוע.",
    tags: ["צעירה", "אורבני", "ליד הרכבת"],
    aliases: ["קייזר", "Kaiser"],
  },
  {
    id: "hanechalim",
    family_label: "ותיקה, ירוקה, משפחתית",
    summary_he:
      "שכונת ספדיה; ידועה בצמחייה בוגרת ופארקים רחבים לאורך העמקים. מציעה תחושה קהילתית יציבה ותמהיל דירות מגוון בבנייה נמוכה ונגישה.",
    tags: ["ירוקה", "ותיקה", "משפחתית"],
    aliases: ["ספדיה", "שכונת ספדיה", "Safdie", "Sefadia"],
  },
  {
    id: "masuah",
    family_label: "אנגלו-סכסית, נוף פתוח, דתית-לאומית",
    summary_he:
      "גבעת C; ממוקמת על נקודה גבוהה עם נוף מרהיב. קהילה מגובשת של עולים, בתי כנסת פעילים ומוסדות חינוך שנחשבים מהמובילים בעיר.",
    tags: ["אנגלו-סכסים", "נוף", "דתי-לאומי"],
    aliases: ["גבעת C", "Givat C", "גבעת סי"],
  },
  {
    id: "hatsiporim",
    family_label: "חדשה, בוטיקית, אסטרטגית",
    summary_he:
      "השכונה החדשה ביותר בעמקים; בניה חדישה בסטנדרט גבוה. אידיאלית ליוממים (Commuters) בזכות יציאה ישירה לכביש 431 וקרבה לטיילת נחל ענבה.",
    tags: ["חדש", "בוטיק", "ליד 431"],
    aliases: ["ציפורים", "Tsiporim", "Tziporim"],
  },
  {
    id: "nofim",
    family_label: "מודרנית, נוף למערב, צעירה",
    summary_he:
      "נבנתה על רכס המשקיף לשפלה; מאופיינת בתכנון מודרני, מוסדות חינוך חדשים וטכנולוגיים וגישה נוחה לצירי תנועה מרכזיים מחוץ לעיר.",
    tags: ["נוף", "חדש", "טכנולוגי"],
    aliases: [],
  },
  {
    id: "hashvatim",
    family_label: "יוקרתית, בניה נמוכה, מעורב",
    summary_he:
      "בוכמן צפון; מאופיינת ברחובות הולנדיים רחבים, צמודי קרקע וגינות מטופחות. מציעה שקט פרברי, קרבה לטבע וליציאה מהעיר לכיוון ירושלים.",
    tags: ["יוקרה", "צמודי קרקע", "שקט"],
    aliases: ["בוכמן צפון", "בוכמן", "Buchman North", "Buchman Tzafon", "Buchman"],
  },
  {
    id: "hareut",
    family_label: "קהילתית, בטחונית, כפרית",
    summary_he:
      "רעות; הוקמה עבור אנשי כוחות הבטחון. מאופיינת בבניה נמוכה, איכות חיים גבוהה מאוד ומרכזים קהילתיים וספורטיביים פעילים.",
    tags: ["כפרית", "קהילתית", "ותיקה"],
    aliases: ["רעות", "Re'ut", "Reut"],
  },
  {
    id: "moriah",
    family_label: "יוקרתית, דתית-לאומית, בניה נמוכה",
    summary_he:
      "בוכמן דרום; מהשכונות המבוקשות ביותר בזכות צמודי קרקע יוקרתיים, אווירה קהילתית חזקה ומוסדות חינוך איכותיים של המגזר הדתי-לאומי.",
    tags: ["יוקרה", "דתי-לאומי", "צמודי קרקע"],
    aliases: ["בוכמן דרום", "בוכמן", "Buchman South", "Buchman Darom", "Buchman"],
  },
  {
    id: "hamakkabim",
    family_label: "כפרית, וותיקה, יוקרתית",
    summary_he:
      "מכבים; רובע המאופיין בבתים פרטיים גדולים על מגרשים רחבים, הרבה צמחייה ותחושת יישוב קהילתי נפרד בתוך העיר.",
    tags: ["כפרית", "יוקרה", "בתים פרטיים"],
    aliases: ["מכבים", "Maccabim"],
  },
  {
    id: "moreshet",
    family_label: "חדשה, משפחתית, מערבית",
    summary_he:
      "השכונה החדשה במערב מודיעין; בנייה חדישה, מתחמי מגורים מתקדמים וקהילה צעירה הנמצאת בתהליך גיבוש.",
    tags: ["חדש", "מערבי", "צעיר"],
    aliases: ["Moreshet"],
  },
];

async function main() {
  const features = loadNeighborhoodFeatures();
  const featureById = new Map(features.features.map((f) => [f.properties.id, f]));

  const validIds = SEED_META.map((s) => s.id);
  const missingFromGeo = SEED_META.filter((s) => !featureById.has(s.id));
  if (missingFromGeo.length > 0) {
    console.error(
      `✗ Missing polygons in public/neighborhoods.geo.json: ${missingFromGeo.map((s) => s.id).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  // Step 1 — wipe orphan dependent rows so we can delete orphan neighborhoods.
  console.log("→ cleaning up orphan rows from prior runs…");
  const validIdList = `(${validIds.map((id) => `"${id}"`).join(",")})`;
  for (const table of ["listings", "transactions", "neighborhood_metrics"]) {
    const { error } = await sb.from(table).delete().not("neighborhood", "in", validIdList);
    if (error && !error.message.includes("0 rows")) {
      console.warn(`  ${table}: ${error.message}`);
    }
  }
  const { error: orphanErr } = await sb
    .from("neighborhoods")
    .delete()
    .not("id", "in", validIdList);
  if (orphanErr) console.warn(`  neighborhoods: ${orphanErr.message}`);

  // Step 2 — upsert from JSON geometry + inline metadata.
  console.log(`→ upserting ${SEED_META.length} neighborhoods from public/neighborhoods.geo.json…`);
  for (const meta of SEED_META) {
    const feature = featureById.get(meta.id)!;
    const ring = feature.geometry.coordinates[0] as [number, number][];
    const polygon = wktPolygon(ring);
    const center = wktPoint(centroidOf(feature));

    const { error } = await sb.from("neighborhoods").upsert({
      id: meta.id,
      name_he: feature.properties.name_he,
      name_en: feature.properties.name_en,
      polygon,
      center,
      family_label: meta.family_label,
      summary_he: meta.summary_he,
      tags: meta.tags,
      aliases: meta.aliases,
    });

    if (error) {
      console.error(`✗ ${meta.id}: ${error.message}`);
      process.exitCode = 1;
    } else {
      const aliasNote = meta.aliases.length > 0 ? `  ↳ aliases: ${meta.aliases.join(", ")}` : "";
      console.log(`✓ ${meta.id} (${feature.properties.name_he})${aliasNote ? "\n" + aliasNote : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

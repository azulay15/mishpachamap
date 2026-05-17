/**
 * Mock data for local dev without Supabase. Mirrors the 13 canonical Modi'in /
 * Maccabim / Re'ut neighborhoods seeded by `scripts/ingest/seed_neighborhoods.ts`.
 * Coordinates here are in 1600x1000 SVG space — they only feed MMMapStub.
 */
import type { ConciergeData } from "@/components/ConciergeScreen";

type MockNeighborhood = ConciergeData["neighborhoods"][number];
type MockPOIFeature = ConciergeData["pois"][number];
type MockListing = ConciergeData["listingsByNeighborhood"][string][number];
type MockSchool = ConciergeData["schoolsByNeighborhood"][string][number];

const N: Omit<MockNeighborhood, "polygon" | "center" | "facts">[] = [
  {
    id: "hareut", he: "הרעות", family: "קהילתית, בטחונית, כפרית",
    summary: "רעות; הוקמה עבור אנשי כוחות הבטחון. בנייה נמוכה ואיכות חיים גבוהה.",
    matchScore: 80, avgListing: 4_650_000, avgPrice: 31_000, avgPriceDelta: 1.6,
    greenScore: 82, schoolScore: 86,
    svgPath: "M 120,260 L 290,260 L 290,470 L 120,470 Z", svgCenter: [205, 365],
  },
  {
    id: "hamakkabim", he: "המכבים", family: "כפרית, וותיקה, יוקרתית",
    summary: "מכבים; בתים פרטיים גדולים, צמחייה רחבה, תחושת יישוב נפרד.",
    matchScore: 78, avgListing: 5_600_000, avgPrice: 36_000, avgPriceDelta: 2.0,
    greenScore: 88, schoolScore: 84,
    svgPath: "M 290,260 L 460,260 L 460,470 L 290,470 Z", svgCenter: [375, 365],
  },
  {
    id: "masuah", he: "משואה", family: "אנגלו-סכסית, נוף פתוח, דתית-לאומית",
    summary: "גבעת C; קהילה אנגלו-סכסית, בתי כנסת פעילים, נוף מרהיב.",
    matchScore: 84, avgListing: 5_100_000, avgPrice: 33_000, avgPriceDelta: 3.4,
    greenScore: 80, schoolScore: 90,
    svgPath: "M 460,260 L 620,260 L 620,470 L 460,470 Z", svgCenter: [540, 365],
  },
  {
    id: "avneichen", he: "אבני חן", family: "צעירה, תוססת, אורבנית",
    summary: "קייזר; שכונה חיה, משפחות צעירות, ליד פארק ענבה והרכבת.",
    matchScore: 82, avgListing: 4_240_000, avgPrice: 28_500, avgPriceDelta: 3.1,
    greenScore: 75, schoolScore: 82,
    svgPath: "M 460,470 L 620,470 L 620,680 L 460,680 Z", svgCenter: [540, 575],
  },
  {
    id: "nofim", he: "נופים", family: "מודרנית, נוף למערב, צעירה",
    summary: "תכנון מודרני, מוסדות חינוך חדשים וגישה נוחה לצירי תנועה.",
    matchScore: 81, avgListing: 4_180_000, avgPrice: 28_700, avgPriceDelta: 1.8,
    greenScore: 81, schoolScore: 82,
    svgPath: "M 620,260 L 800,260 L 800,470 L 620,470 Z", svgCenter: [710, 365],
  },
  {
    id: "haprachim", he: "הפרחים", family: "מרכזית, חילונית, נגישה",
    summary: "הלב של העיר; שילוב בניה ותיקה ומגדלים, מרחק הליכה לעירייה ולקניון.",
    matchScore: 76, avgListing: 4_240_000, avgPrice: 29_000, avgPriceDelta: 2.5,
    greenScore: 71, schoolScore: 80,
    svgPath: "M 620,470 L 800,470 L 800,610 L 620,610 Z", svgCenter: [710, 540],
  },
  {
    id: "hanechalim", he: "הנחלים", family: "ותיקה, ירוקה, משפחתית",
    summary: "שכונת ספדיה; צמחייה בוגרת, פארקים רחבים ותחושה קהילתית יציבה.",
    matchScore: 77, avgListing: 3_900_000, avgPrice: 27_500, avgPriceDelta: 1.5,
    greenScore: 79, schoolScore: 80,
    svgPath: "M 620,610 L 800,610 L 800,790 L 620,790 Z", svgCenter: [710, 700],
  },
  {
    id: "hakramim", he: "הכרמים", family: "משפחתית, מעורב, שקטה",
    summary: "השכונה הצפונית; רחובות מעגליים, פארק הכרמים ומרכז מסחרי מודרני.",
    matchScore: 86, avgListing: 4_180_000, avgPrice: 30_100, avgPriceDelta: 2.4,
    greenScore: 78, schoolScore: 86,
    svgPath: "M 800,260 L 1000,260 L 1000,470 L 800,470 Z", svgCenter: [900, 365],
  },
  {
    id: "hashvatim", he: "השבטים", family: "יוקרתית, בניה נמוכה, מעורב",
    summary: "בוכמן צפון; רחובות הולנדיים רחבים, צמודי קרקע, שקט פרברי.",
    matchScore: 91, avgListing: 5_200_000, avgPrice: 35_000, avgPriceDelta: 4.4,
    greenScore: 86, schoolScore: 88,
    svgPath: "M 1000,260 L 1200,260 L 1200,470 L 1000,470 Z", svgCenter: [1100, 365],
  },
  {
    id: "moriah", he: "מוריה", family: "יוקרתית, דתית-לאומית, בניה נמוכה",
    summary: "בוכמן דרום; מהשכונות המבוקשות, צמודי קרקע יוקרתיים וקהילה דתית-לאומית.",
    matchScore: 89, avgListing: 5_120_000, avgPrice: 34_200, avgPriceDelta: 5.2,
    greenScore: 88, schoolScore: 88,
    svgPath: "M 1000,470 L 1200,470 L 1200,680 L 1000,680 Z", svgCenter: [1100, 575],
  },
  {
    id: "hanevim", he: "הנביאים", family: "חילונית, נגישה, בניה מגוונת",
    summary: "שמשוני צפון; תמהיל דירות רחב, קרבה לעמקים וגני ילדים בשפע.",
    matchScore: 79, avgListing: 3_980_000, avgPrice: 28_000, avgPriceDelta: 2.9,
    greenScore: 76, schoolScore: 80,
    svgPath: "M 800,610 L 1000,610 L 1000,790 L 800,790 Z", svgCenter: [900, 700],
  },
  {
    id: "hameginim", he: "המגינים", family: "משפחתית, מגוונת, פארקים",
    summary: "שמשוני דרום; פארקים ייחודיים (פארק החרגול), בתי ספר רבים, אווירה חמה.",
    matchScore: 75, avgListing: 3_750_000, avgPrice: 27_000, avgPriceDelta: 1.4,
    greenScore: 76, schoolScore: 82,
    svgPath: "M 1000,610 L 1200,610 L 1200,790 L 1000,790 Z", svgCenter: [1100, 700],
  },
  {
    id: "hatsiporim", he: "הציפורים", family: "חדשה, בוטיקית, אסטרטגית",
    summary: "השכונה החדשה בעמקים; בנייה חדישה, יציאה ל-431 וטיילת נחל ענבה.",
    matchScore: 83, avgListing: 4_900_000, avgPrice: 32_500, avgPriceDelta: 4.8,
    greenScore: 84, schoolScore: 80,
    svgPath: "M 1200,610 L 1400,610 L 1400,790 L 1200,790 Z", svgCenter: [1300, 700],
  },
];

function dummyPolygon(): GeoJSON.Polygon {
  return { type: "Polygon", coordinates: [[[35, 31.9], [35.01, 31.9], [35.01, 31.91], [35, 31.91], [35, 31.9]]] };
}

const ALIASES_BY_ID: Record<string, string[]> = {
  hareut: ["רעות", "Re'ut", "Reut"],
  hamakkabim: ["מכבים", "Maccabim"],
  masuah: ["גבעת C", "Givat C"],
  avneichen: ["קייזר", "Kaiser"],
  haprachim: ["מירומי", "Miromi"],
  hanechalim: ["ספדיה", "Safdie"],
  hakramim: ["כרמים", "Kramim"],
  hashvatim: ["בוכמן צפון", "בוכמן", "Buchman North", "Buchman"],
  moriah: ["בוכמן דרום", "בוכמן", "Buchman South", "Buchman"],
  hanevim: ["שמשוני צפון", "שמשוני", "Shimshoni North", "Shimshoni"],
  hameginim: ["שמשוני דרום", "שמשוני", "Shimshoni South", "Shimshoni"],
  hatsiporim: ["ציפורים", "Tsiporim"],
  nofim: [],
};

const NEIGHBORHOODS: MockNeighborhood[] = N.map((n) => ({
  ...n,
  aliases: ALIASES_BY_ID[n.id] ?? [],
  polygon: dummyPolygon(),
  center: [35.005, 31.905],
  facts: {
    id: n.id,
    avgListing: n.avgListing,
    gardenAvailability: 0.5,
    schoolWalkMeters: 500,
    parkMeters: 400,
    shopMeters: 500,
    transitMeters: 1200,
    quietScore: 70,
    greenScore: n.greenScore,
    celiacDistance: 800,
    celiacDensity: 2,
  },
}));

// POI mock — same set as before, redistributed via approximate visual placement.
// IDs use the new neighborhood IDs where they reference one.
const POIS_RAW: { id: string; type: string; name: string; pos: [number, number] }[] = [
  // Schools
  { id: "s1", type: "school", pos: [1080, 360], name: "ממ\"ד יחד מודיעין" },
  { id: "s2", type: "school", pos: [880, 360], name: "בית ספר נופי הפרחים" },
  { id: "s3", type: "school", pos: [700, 360], name: "בית ספר נופים" },
  { id: "s4", type: "school", pos: [540, 575], name: "בית ספר רימון" },
  { id: "s5", type: "school", pos: [900, 700], name: "בית ספר שמשוני" },
  { id: "s6", type: "school", pos: [1100, 575], name: "אמית מוריה" },
  { id: "s7", type: "school", pos: [540, 365], name: "בית ספר משואה" },
  { id: "s8", type: "school", pos: [1300, 700], name: "בית ספר הציפורים" },
  // Preschools
  { id: "p1", type: "preschool", pos: [1060, 370], name: "גן עירוני שלום" },
  { id: "p2", type: "preschool", pos: [1130, 410], name: "גן רימון" },
  { id: "p3", type: "preschool", pos: [870, 410], name: "גן הסביונים" },
  { id: "p4", type: "preschool", pos: [710, 540], name: "גן מרכז" },
  { id: "p5", type: "preschool", pos: [880, 720], name: "גן השומרון" },
  { id: "p6", type: "preschool", pos: [1130, 700], name: "גן ארזים" },
  // Parks
  { id: "k1", type: "park", pos: [1100, 365], name: "פארק השבטים" },
  { id: "k2", type: "park", pos: [880, 320], name: "פארק הכרמים" },
  { id: "k3", type: "park", pos: [690, 470], name: "פארק נופים" },
  { id: "k4", type: "park", pos: [540, 620], name: "פארק ענבה" },
  { id: "k5", type: "park", pos: [1100, 770], name: "פארק מוריה" },
  { id: "k6", type: "park", pos: [840, 540], name: "פארק האנוסים" },
  { id: "k7", type: "park", pos: [1100, 700], name: "פארק החרגול" },
  // Shops
  { id: "h1", type: "shop", pos: [1090, 480], name: "שופרסל בוכמן" },
  { id: "h2", type: "shop", pos: [710, 540], name: "עזריאלי מודיעין" },
  { id: "h3", type: "shop", pos: [710, 430], name: "סופר נופים" },
  { id: "h4", type: "shop", pos: [540, 640], name: "רמי לוי קייזר" },
  { id: "h5", type: "shop", pos: [900, 740], name: "יש שמשוני" },
  // Transit
  { id: "t1", type: "transit", pos: [710, 580], name: "רכבת מודיעין מרכז" },
  { id: "t2", type: "transit", pos: [540, 470], name: "תחנת רכבת פאתי שורש" },
  // Community
  { id: "c1", type: "community", pos: [1100, 500], name: "בית כנסת השבטים" },
  { id: "c2", type: "community", pos: [880, 410], name: "בית כנסת הכרמים" },
  { id: "c3", type: "community", pos: [1100, 770], name: "מרכז קהילתי מוריה" },
  { id: "c4", type: "community", pos: [870, 640], name: "מתנ\"ס מודיעין" },
  { id: "c5", type: "community", pos: [540, 365], name: "בית כנסת משואה" },
  // Celiac-Friendly
  { id: "celiac-1", type: "celiac", pos: [1080, 470], name: "Free Slice Pizza" },
  { id: "celiac-2", type: "celiac", pos: [880, 440], name: "מאפיית הגלוטן החופשית" },
  { id: "celiac-3", type: "celiac", pos: [1180, 720], name: "Susu Sushi · תפריט GF" },
  { id: "celiac-4", type: "celiac", pos: [1010, 540], name: "שופרסל דיל · מדף מיוחד" },
  { id: "celiac-5", type: "celiac", pos: [900, 380], name: "טבע נטורל הכרמים" },
];

const POIS: MockPOIFeature[] = POIS_RAW.map((p) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [35.005, 31.905] },
  properties: { id: p.id, type: p.type as never, name_he: p.name, svgPos: p.pos },
}));

const LISTINGS_BY_NB: Record<string, MockListing[]> = {
  hashvatim: [
    { id: "L-7842", address: "לוי 14, השבטים", price_nis: 5_290_000, price_per_m2: 35_200, rooms: 6, sqm: 158, garden_sqm: 80, status_he: "חדש בשוק", days_on_market: 3, matchScore: 92 },
    { id: "L-7811", address: "ראובן 22, השבטים", price_nis: 4_890_000, price_per_m2: 34_300, rooms: 5, sqm: 144, garden_sqm: 35, status_he: null, days_on_market: 14, matchScore: 89 },
  ],
  hakramim: [
    { id: "L-7641", address: "הגפן 8, הכרמים", price_nis: 4_250_000, price_per_m2: 30_200, rooms: 5, sqm: 141, garden_sqm: 90, status_he: "ירידת מחיר", days_on_market: 22, matchScore: 86 },
    { id: "L-7588", address: "הכרמים 31", price_nis: 3_980_000, price_per_m2: 29_700, rooms: 5, sqm: 134, garden_sqm: 24, status_he: null, days_on_market: 8, matchScore: 85 },
  ],
  moriah: [
    { id: "L-7503", address: "ההגנה 22, מוריה", price_nis: 5_180_000, price_per_m2: 34_800, rooms: 5, sqm: 149, garden_sqm: 60, status_he: "פתוח להצעות", days_on_market: 11, matchScore: 89 },
  ],
  nofim: [
    { id: "L-7440", address: "הרקפת 12, נופים", price_nis: 3_810_000, price_per_m2: 28_900, rooms: 4, sqm: 132, garden_sqm: 50, status_he: null, days_on_market: 19, matchScore: 81 },
  ],
  masuah: [
    { id: "L-7401", address: "ההר 8, משואה", price_nis: 5_280_000, price_per_m2: 33_400, rooms: 5, sqm: 158, garden_sqm: null, status_he: "חדש בשוק", days_on_market: 5, matchScore: 87 },
  ],
  avneichen: [
    { id: "L-7321", address: "ספיר 4, אבני חן", price_nis: 4_120_000, price_per_m2: 28_800, rooms: 4, sqm: 143, garden_sqm: null, status_he: null, days_on_market: 16, matchScore: 82 },
  ],
  hareut: [], hamakkabim: [], haprachim: [], hanechalim: [], hanevim: [], hameginim: [], hatsiporim: [],
};

function mockSchool(
  id: string,
  name: string,
  meitzav: number,
  walk: number,
  level: string,
  orientation: string | null = null,
  bagrut: number | null = null,
  students: number | null = null,
): MockSchool {
  return {
    id,
    name_he: name,
    meitzav_score: meitzav,
    walkMinutes: walk,
    level,
    orientation,
    bagrutPassRate: bagrut,
    studentCount: students,
    websiteUrl: null,
  };
}

const SCHOOLS_BY_NB: Record<string, MockSchool[]> = {
  hashvatim: [
    mockSchool("s1", 'ממ"ד יחד מודיעין', 9.2, 6, "elementary", 'ממ"ד', null, 420),
    mockSchool("s1b", "תיכון רבין", 8.7, 11, "high", "ממלכתי", 94, 880),
  ],
  hakramim: [
    mockSchool("s2", "בית ספר נופי הפרחים", 8.8, 8, "elementary", "ממלכתי", null, 510),
    mockSchool("s2b", "חטיבת ביניים גוונים", 8.5, 10, "middle", "ממלכתי", null, 360),
  ],
  nofim: [mockSchool("s3", "בית ספר נופים", 8.4, 7, "elementary", "ממלכתי", null, 480)],
  avneichen: [mockSchool("s4", "בית ספר רימון", 8.0, 11, "elementary", "ממלכתי", null, 410)],
  hanevim: [mockSchool("s5", "בית ספר שמשוני", 8.6, 5, "elementary", "ממלכתי", null, 530)],
  moriah: [mockSchool("s6", "אמית מוריה", 9.4, 6, "elementary", 'ממ"ד', null, 450)],
  masuah: [mockSchool("s7", "בית ספר משואה", 9.1, 7, "elementary", 'ממ"ד', null, 470)],
  hatsiporim: [mockSchool("s8", "בית ספר הציפורים", 8.5, 4, "elementary", "ממלכתי", null, 440)],
  hareut: [], hamakkabim: [], haprachim: [], hanechalim: [], hameginim: [],
};

export const MOCK_DATA: ConciergeData = {
  neighborhoods: NEIGHBORHOODS,
  pois: POIS,
  listingsByNeighborhood: LISTINGS_BY_NB,
  schoolsByNeighborhood: SCHOOLS_BY_NB,
};

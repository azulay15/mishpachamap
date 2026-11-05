/**
 * Per-neighborhood safety signal from the Israel Police crime dataset
 * (data.gov.il `crime_records_data`, resource 5fc13c50, per city, 2024).
 *
 * The police use their OWN older statistical-area scheme (e.g. 24000010,
 * 83000311) with a Hebrew area NAME, NOT the CBS 2022 codes our polygons use.
 * We map each police area to a neighborhood two ways:
 *   1. AUTO-MATCH by name — most areas carry the neighborhood name (נווה סביון,
 *      קריית גיורא, רמב"ם, רמז…), so a normalized name match finds the right
 *      neighborhood. This scales to any city whose police names match ours.
 *   2. OVERRIDE map (CROSSWALKS) — for areas whose name doesn't match (old
 *      aliases like Modi'in's ספדיה/בוכמן/קייזר, or ambiguous ones like
 *      "מרכז העיר" / "עמידר" / "היקב"). An override to null excludes an area.
 * Industrial/commercial areas (אזור תעשייה / מב"ת) and the city-wide bucket
 * (code 0 / no name) are excluded from residential safety.
 *
 * Counts are 2024 REPORTED cases, normalized per 1,000 residents from the
 * city's demographics file. Reported-crime density, not fear.
 *
 * Output: public/<city>.crime.json (static, no DB migration).
 * Usage:  npx tsx scripts/ingest/crime.ts --city oryehuda
 *         (run demographics for that city first, for population)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CITIES } from "./cities";

/**
 * Per-city police-area → neighborhood overrides. Only areas that DON'T
 * name-match (or need a judgment call) go here; the rest auto-match. `null`
 * excludes an area from residential safety.
 */
const CROSSWALKS: Record<string, Record<number, string | null>> = {
  // Modi'in's police area names are OLD aliases that don't match the current
  // neighborhood names, so its whole crosswalk is explicit (name-matched by hand).
  modiin: {
    12000011: "hanechalim", 12000012: "hanechalim", 12000015: "hanechalim",
    12000016: "haprachim", 12000017: "haprachim",
    12000021: "hatsiporim",
    12000022: "hanevim", 12000023: "hameginim", 12000026: "hameginim",
    12000024: "avneichen", 12000025: "avneichen", 12000031: "avneichen",
    12000013: "hashvatim", 12000033: "hashvatim", 12000034: "moriah",
    12000041: "hareut", 12000042: "hareut", 12000043: "hamakkabim",
    12000032: null, // הפארק הטכנולוגי — commercial
  },
  // Or Yehuda: neve-savyon / neve-rabin / kiryat-giora auto-match; these are the
  // judgment calls (veteran-housing + civic areas → their nearest neighborhood).
  oryehuda: {
    24000012: "kiryat-giora", // שיכון ממשלתי (veteran housing, east-center)
    24000007: null, // מרכז העיר — commercial civic center (crime ≠ residential pop)
    24000008: "kiryat-giora", // עמידר (public housing)
    24000004: "shchunot-dromiyot", // ההסתדרות (צפון)
    24000005: "shchunot-dromiyot", // ההסתדרות (דרום)
  },
  // Rishon LeZion: ~50 areas auto-match; these are name-mismatches (spelling
  // variants) + genuine judgment calls (city-center, winery, נווה אליהו).
  rishon: {
    83000314: null, // מרכז העיר (1) — commercial center (crime ≠ residential pop)
    83000315: null, // מרכז העיר (2) — commercial center
    83000225: null, // היקב (Carmel winery / commercial, old center-east)
    83000114: "kidmat-rishon", // קידמת ראשון (spelling: קידמת vs קדמת)
    83000521: "kiryat-rishon", // קרית ראשון (מזרח)
    83000522: "kiryat-rishon", // קרית ראשון (מערב)
    83000514: "kiryat-rishon", // נווה אליהו (west cluster)
    83000523: "kiryat-kramim", // קרית כרמים (מזרח)
    83000524: "kiryat-kramim", // קרית כרמים (מערב)
    83000123: "rambam", // רובע רמב''ם (צפון) — double-quote variant
  },
  // Kfar Saba: police scheme is street-level, so many areas don't auto-match.
  // Confident placements + institutional/commercial discards below.
  // ⚠ REVIEW — street-level areas left unplaced (their crimes aren't attributed
  //   until a local expert assigns them): 69000034 דגניה, 69000044 תקומה,
  //   69000054 מוצקין/דובדבן, 69000043 קרן אברהם, 69000042 משה שרת/ביאליק,
  //   69000053 משכנות, 69000016 אז"ר/כצנלסון.
  kefarsava: {
    69000015: "ks-tzeira", // גני השרון (Ganei Sharon — SA114 area)
    69000033: "ks-yeruka", // קרית ספיר (Kiryat Sapir, NW green)
    69000036: "rishonim", // רחובות התחיה / אנה פרנק (SA323 area)
    69000052: "haprachim", // קרת ספר מזרח (alt name for HaPrachim)
    69000055: "hapark", // חצרות הדר (מערב) — pairs with 69000056 (east)
    69000035: null, // בי"ח גריאטרי — geriatric hospital, ~0 residents
    69000051: null, // תחנה מרכזית — central bus station, commercial
  },
  // Ra'anana: police names are street/sub-area level. Mapped where the name
  // states a neighborhood; school- and street-only areas left unplaced.
  raanana: {
    87000023: "rasco-ben-tzvi", // קרית בן צבי (רסקו) קרית שז"ר
    87000018: "kiryat-remez", // קרית דוד רמז (דרום-מזרח)
    87000019: "kiryat-remez", // קרית דוד רמז (דרום-מערב)
    87000013: "kiryat-remez", // לסטר/רבוצקי + קרית רמז (צפון-מזרח) — compound, remez named
    87000025: "kiryat-ganim", // קרית גנים שיכון אשר 2003 (מערב)
    87000024: "kiryat-ganim", // 2003 (מזרח) — שכונת 2003 is part of the Kiryat Ganim area
    87000033: "ha-mea", // אוסטרובסקי/פרדס משותף — exactly HaMe'a's stated bounds
  },
  // Herzliya: ditto. Note קרית רבין / גבעת הסופר are not in the neighborhood
  // roster (sub-areas), so they stay unplaced rather than being force-fitted.
  herzliya: {
    64000051: "gan-rashal", // גן רש"ל נחלת עדה (the two share one stat area)
    64000056: "shchunat-weizmann", // וייצמן (מזרח)
    64000057: "shchunat-weizmann", // וייצמן (מערב)
    64000033: null, // תחנה מרכזית + המועצה הדתית — civic/commercial
  },
  // Netanya: 35 unmatched, mostly street-level or civic. Confident placements
  // below; the hotel strip / stadium / college are excluded as non-residential.
  netanya: {
    74000117: "kiryat-hasharon", // קרית השרון צפון
    74000522: "kiryat-nordau", // קרית נורדאו (צפון-מערב)
    74000521: "kiryat-nordau", // קרית נורדאו (דרום-מערב)
    74000512: "kiryat-nordau", // קרית נורדאו (דרום-מזרח)
    74000312: "merkaz-hair-tzafon-mizrach", // מרכז העיר (צפון-מזרח)
    74000313: "merkaz-hair-tzafon-maarav", // מרכז העיר (צפון-מערב)
    74000213: "neot-herzl", // רמת הרצל — a component of Neot Herzl
    74000211: "neot-herzl", // אום חאלד סלע — שיכון סלע is part of Neot Herzl
    74000533: "ramat-poleg", // נאות מנחם בגין (דרום) — known as Ramat Poleg
    74000322: null, // רצועת החוף והמלונות (צפון) — hotel strip, commercial
    74000323: null, // רצועת החוף והמלונות (דרום) — hotel strip, commercial
    74000243: null, // אזור אצטדיון הקופסא — stadium
    74000321: null, // המכללה למנהל — college campus
  },
  // Petah Tikva: 32 unmatched. The industrial zones here are already discarded
  // from the polygon build, so they map to null for safety too.
  petahtikva: {
    79000111: null, // סגולה — industrial zone
    79000128: null, // רמת סיב — business park
    79000125: null, // קרית אריה (מזרח) — industrial
    79000311: null, // עיריית פ"ת + בי"ס — civic core
    79000312: null, // השוק העירוני — municipal market, commercial
    79000313: null, // היכל לתרבות + תחנת משטרה — civic
    79000231: null, // בי"ח השרון — hospital
    79000121: "em-hamoshavot-hadasha", // הדר המושבות החדשה (מרכז)
    79000129: "em-hamoshavot-hadasha", // הדר המושבות החדשה (ב')
    79000122: "em-hamoshavot-vatika", // הדר המושבות הותיקה
    79000523: "hadar-ganim", // גני הדר — folded into Hadar Ganim
    79000422: "ein-ganim", // עין הגנים (דרום)
    79000321: "ein-ganim", // עין הגנים (צפון)
    79000515: "kiryat-alon", // קרית אלון (מזרח) קרית דוד אליעזר
  },
  // Haifa: police codes are 4000xxxx where xxxx is the (older) CBS stat-area
  // number, and almost all still line up with the 2022 SAs our polygons use
  // (names confirm it). So the crosswalk is FULLY explicit, keyed off the SA,
  // not auto-match: our compound names (e.g. "קריית שפרינצק ועין הים") make
  // the substring matcher unreliable, and it mis-files "הדר (צפון-מערב)".
  haifa: {
    40000111: "hfa-kiryat-shmuel", 40000112: "hfa-kiryat-shmuel",
    40000121: "hfa-kiryat-haim-west", 40000122: "hfa-kiryat-haim-west",
    40000131: "hfa-kiryat-haim-east", 40000132: "hfa-kiryat-haim-east", 40000133: "hfa-kiryat-haim-east",
    40000134: "hfa-kiryat-haim-east", 40000135: "hfa-kiryat-haim-east",
    40000123: null, // מתחם מיכלי הנפט — tank farm
    40000221: null, // מכון הטיהור — sewage works
    40000231: null, // אזור הקישון — port industry
    40000232: null, // נמל חיפה — port
    40000314: null, // ואדי סאליב — lower-city commercial core (crime ≠ residential pop)
    40000324: null, // העיר התחתית (מרכז) - שער פלמר — commercial core, ditto
    40000331: "hfa-wadi-nisnas", 40000332: "hfa-wadi-nisnas", 40000333: "hfa-wadi-nisnas",
    40000334: "hfa-german-colony",
    40000411: "hfa-kiryat-eliezer", 40000412: "hfa-kiryat-eliezer", 40000413: "hfa-kiryat-eliezer", 40000414: "hfa-kiryat-eliezer",
    40000417: "hfa-bat-galim",
    // בת גלים (מזרח) + Rambam hospital: can't be split, so it stays with Bat
    // Galim and the implausible-rate guard suppresses the result.
    40000418: "hfa-bat-galim",
    40000421: "hfa-kiryat-sprinzak", 40000422: "hfa-kiryat-sprinzak", 40000423: "hfa-kiryat-sprinzak",
    40000424: "hfa-shaar-haaliya",
    40000425: "hfa-neve-david", 40000426: "hfa-neve-david",
    40000511: "hfa-carmelia", 40000512: "hfa-carmelia", // 512 = SA512 (Shambur)
    40000513: "hfa-vardia", 40000514: "hfa-vardia", // 513 = SA513 (Na'amat)
    40000521: "hfa-merkaz-hacarmel", 40000522: "hfa-merkaz-hacarmel", 40000523: "hfa-merkaz-hacarmel", 40000524: "hfa-merkaz-hacarmel",
    40000525: "hfa-carmel-west", 40000526: "hfa-carmel-west", 40000528: "hfa-carmel-west",
    40000527: "hfa-kababir",
    40000531: "hfa-ramat-shaul",
    40000532: "hfa-french-carmel",
    40000533: "hfa-ramat-hatishbi",
    40000611: "hfa-abbas", 40000612: "hfa-abbas", 40000613: "hfa-abbas", // SA611-613 (Abbas, Bahai gardens, Masada)
    40000621: "hfa-hadar-elyon", 40000622: "hfa-hadar-elyon", 40000623: "hfa-hadar-elyon",
    40000631: "hfa-hadar-merkaz", 40000632: "hfa-hadar-merkaz", 40000633: "hfa-hadar-merkaz", 40000634: "hfa-hadar-merkaz",
    40000641: "hfa-geula", 40000642: "hfa-geula",
    40000643: "hfa-ramat-vizhnitz",
    40000711: "hfa-halisa", 40000712: "hfa-halisa",
    40000713: "hfa-neve-paz", // נווה גנים (צפון) = SA713
    40000714: "hfa-neve-yosef",
    40000721: "hfa-neve-shaanan", 40000722: "hfa-neve-shaanan", 40000723: "hfa-neve-shaanan",
    40000731: "hfa-yizreelia", 40000732: "hfa-yizreelia", 40000733: "hfa-yizreelia",
    40000811: "hfa-ziv",
    40000812: null, // קרית הטכניון — campus
    40000813: "hfa-ramat-alon",
    40000821: "hfa-ramot-remez", 40000822: "hfa-ramot-remez",
    40000823: "hfa-ramat-sapir", 40000824: "hfa-ramat-sapir",
    40000825: null, // גבעת זמר — open land
    40000911: "hfa-romema", 40000912: "hfa-romema", // רמת בן גוריון (צפון) = SA911 (רוממה החדשה)
    40000921: "hfa-ahuza", 40000922: "hfa-ahuza",
    40000933: "hfa-ahuza", 40000934: "hfa-ahuza", // police call these רמת בן גוריון; SA933/934 are Ahuza (Givat Downes)
    40000931: "hfa-ramat-begin", 40000932: "hfa-ramat-begin",
    40000941: "hfa-ramat-golda", 40000942: "hfa-ramat-golda",
    40000943: "hfa-savyonei-hacarmel",
    40000944: "hfa-hod-hacarmel",
    40000945: null, // אוניברסיטת חיפה — campus
    // 40000432/433 (מת"ם) are already excluded as industrial; note 433's police
    // area is MATAM, so Neot Peres (CBS SA433 since 2022) has no police area.
  },
  // Jerusalem: the police use the OLD (pre-2022) numbering, which no longer
  // lines up with CBS 2022 codes (e.g. police 30000411 = Ramat Shlomo, CBS 411
  // = Ramot), so this is FULLY explicit and name-based. Auto-match is unsafe
  // here: "פת" substring-matches "הצרפתית", "שועפאט" matches the camp unit, and
  // "המבתר" trips the non-residential regex.
  // Unplaced on purpose (ambiguous, spans several of our units):
  //   30000835 אחווה יגיע כפיים, 30001351 מעלות מוריה.
  jerusalem: {
    30000111: "jlm-neve-yaakov", 30000112: "jlm-neve-yaakov", 30000113: "jlm-neve-yaakov",
    30000114: "jlm-neve-yaakov", 30000115: "jlm-neve-yaakov", 30000116: "jlm-neve-yaakov",
    30000121: "jlm-pisgat-zeev", 30000122: "jlm-pisgat-zeev", 30000123: "jlm-pisgat-zeev", 30000124: "jlm-pisgat-zeev",
    30000125: "jlm-pisgat-zeev", 30000131: "jlm-pisgat-zeev", 30000132: "jlm-pisgat-zeev", 30000133: "jlm-pisgat-zeev",
    30000134: "jlm-pisgat-zeev", 30000135: "jlm-pisgat-zeev", 30000136: "jlm-pisgat-zeev",
    30000411: "jlm-ramat-shlomo", 30000412: "jlm-ramat-shlomo", 30000413: "jlm-ramat-shlomo",
    30000421: "jlm-ramot", 30000422: "jlm-ramot", 30000423: "jlm-ramot", 30000424: "jlm-ramot", 30000425: "jlm-ramot",
    30000426: "jlm-ramot", 30000431: "jlm-ramot", 30000432: "jlm-ramot", 30000433: "jlm-ramot", 30000434: "jlm-ramot",
    30000435: "jlm-ramot", 30000436: "jlm-ramot", // 436 עמק הארזים — the Ramot quarter's police area
    30000511: null, // הר חוצבים — hi-tech park
    30000512: "jlm-tel-arza", 30000513: "jlm-tel-arza", 30000514: "jlm-tel-arza", // עזרת תורה, שיכון חב"ד, מחניים תל ארזה
    30000515: "jlm-sanhedria", 30000521: "jlm-sanhedria",
    30000522: "jlm-ramat-eshkol", // "רמות אשכול" — a spelling of רמת אשכול, not Ramot
    30000523: "jlm-ramat-eshkol", // גבעת המבתר רמת אשכול
    30000531: "jlm-maalot-dafna", 30000532: "jlm-maalot-dafna", 30000533: "jlm-maalot-dafna",
    30000541: "jlm-french-hill", 30000542: "jlm-french-hill",
    30000543: null, // הר הצופים — Hadassah + Hebrew University campus
    30000812: "jlm-musrara",
    30000821: "jlm-mea-shearim",
    30000822: "jlm-beit-israel", 30000823: "jlm-beit-israel",
    30000824: "jlm-bukharim",
    30000825: "jlm-geula", 30000836: "jlm-geula", // גאולה, זכרון משה
    30000826: "jlm-kerem-avraham",
    30000832: "jlm-mekor-baruch", 30000834: "jlm-mekor-baruch",
    30000833: "jlm-nachlaot", // מחנה יהודה (צפון)
    30000854: "jlm-nachlaot", 30000855: "jlm-nachlaot", // זכרון יוסף/שבט צדק, זכרון טוביה/נחלת ציון — Nachlaot courtyards
    30000856: "jlm-nachlaot", 30000857: "jlm-nachlaot",
    30000841: null, // מרכז ירושלים — commercial center (crime ≠ residential pop)
    30000846: null, // גן העצמאות — park
    30000848: null, // נחלת שבעה / מדרחוב בן-יהודה — commercial core
    30000853: null, // שוק מחנה יהודה / מרכז כלל — market + mall
    30000862: "jlm-rehavia", 30000863: "jlm-rehavia", 30000864: "jlm-rehavia", // קרית שמואל is inside our Rehavia unit
    30000911: "jlm-kiryat-sanz", 30000912: "jlm-kiryat-sanz",
    30000913: "jlm-romema", // קריית מטרסדורף — SA922, part of our Romema unit
    30000914: "jlm-romema", 30000915: "jlm-romema", 30000916: "jlm-romema", // 914 includes the central bus station
    30000921: "jlm-givat-shaul", 30000922: "jlm-givat-shaul", 30000923: "jlm-givat-shaul",
    30000924: null, // אזור תעשייה גבעת שאול + הר המנוחות
    30000931: "jlm-har-nof", 30000932: "jlm-har-nof", 30000933: "jlm-har-nof", 30000934: "jlm-har-nof",
    30001011: "jlm-beit-hakerem", 30001012: "jlm-beit-hakerem", 30001013: "jlm-beit-hakerem", 30001014: "jlm-beit-hakerem", // 1011 = יפה נוף
    30001015: "jlm-kiryat-moshe", 30001016: "jlm-kiryat-moshe",
    30001021: null, // קרית בן גוריון / קרית הלאום — government precinct
    30001022: "jlm-nayot",
    30001023: null, 30001024: null, // גבעת רם — university campus
    30001031: "jlm-bayit-vegan", 30001032: "jlm-bayit-vegan", 30001034: "jlm-bayit-vegan", 30001035: "jlm-bayit-vegan",
    30001041: "jlm-ramat-sharett", 30001042: "jlm-ramat-sharett", 30001043: "jlm-ramat-sharett",
    30001044: "jlm-holyland",
    30001114: null, // הדסה עין כרם — hospital
    30001115: "jlm-ein-kerem",
    30001121: "jlm-kiryat-hayovel", 30001122: "jlm-kiryat-hayovel", 30001123: "jlm-kiryat-hayovel", 30001124: "jlm-kiryat-hayovel",
    30001131: "jlm-kiryat-hayovel", 30001132: "jlm-kiryat-hayovel", 30001133: "jlm-kiryat-hayovel",
    30001134: "jlm-kiryat-menachem", 30001141: "jlm-kiryat-menachem", 30001142: "jlm-kiryat-menachem", 30001143: "jlm-kiryat-menachem", // עיר גנים א'-ג', קרית מנחם
    30001144: "jlm-givat-masua",
    30001147: "jlm-malha", // מלחה / מורדות מלחה
    30001211: "jlm-katamonim", 30001212: "jlm-katamonim", 30001213: "jlm-katamonim", // גונן ט', גונן ח', פת
    30001214: "jlm-katamonim", 30001215: "jlm-katamonim", 30001217: "jlm-katamonim",
    30001216: "jlm-old-katamon", 30001311: "jlm-old-katamon", 30001312: "jlm-old-katamon",
    30001221: "jlm-givat-mordechai",
    30001222: "jlm-rassco", 30001223: "jlm-rassco",
    30001313: "jlm-german-colony", 30001314: "jlm-german-colony",
    30001321: "jlm-talbiyeh",
    30001322: null, // מתחם ימק"א — hotel/civic compound
    30001333: "jlm-baka", 30001334: "jlm-baka", 30001335: "jlm-baka",
    30001336: "jlm-talpiot", // צמרת אלנבי — CBS SA1331
    // ימין משה + הר ציון + גבעת חנניה + צפון תלפיות in ONE police area spans
    // three of our units (Talbiyeh, Abu Tor, Talpiot), so it can't be attributed.
    30001337: null,
    30001341: "jlm-ramot-rachel",
    30001342: "jlm-talpiot", 30001344: "jlm-talpiot",
    30001343: "jlm-arnona", // ארנונה תלפיות (דרום-מזרח)
    30001345: null, // אזור תעשייה ומסחר תלפיות
    30001346: "jlm-mekor-haim",
    30001352: "jlm-east-talpiot", 30001353: "jlm-east-talpiot", 30001354: "jlm-east-talpiot", 30001355: "jlm-east-talpiot",
    30001622: "jlm-har-homa", 30001623: "jlm-har-homa", 30001624: "jlm-har-homa", 30001625: "jlm-har-homa",
    30001626: null, // מנזר מר אליאס — monastery
    30001631: "jlm-gilo", 30001632: "jlm-gilo", 30001633: "jlm-gilo", 30001634: "jlm-gilo",
    30001641: "jlm-gilo", 30001642: "jlm-gilo", 30001643: "jlm-gilo", 30001644: "jlm-gilo",
    // Kafr Aqab and the Shu'fat camp / New Anata area lie beyond the separation
    // barrier, where police presence and reporting are limited, so their case
    // counts aren't comparable with the rest of the city. Left empty on purpose.
    30002111: null, // כפר עקב עטרות
    30002212: null, // מחנה פליטים שועפאט
    30002213: null, // ענאתה החדשה
    30002112: "jlm-beit-hanina", // police name: בית חנינא
    30002211: "jlm-shuafat", // police name: שועפאט
    30002311: "jlm-issawiya",
    30002312: "jlm-a-tur", // א-טור ומורדות הר הזיתים
    30002411: "jlm-sheikh-jarrah", // ואדי אל ג'וז ושיח ג'ראח
    30002412: "jlm-bab-a-zahra", // באב א זהרה ומסעודיה
    30002511: "jlm-muslim-quarter", 30002512: "jlm-jewish-quarter", 30002513: "jlm-armenian-quarter", 30002514: "jlm-christian-quarter",
    30002611: "jlm-silwan",
    // אבו תור covers the eastern part only; the western part (גבעת חנניה) sits in
    // 30001337 above, so the rate would be understated. Left empty.
    30002612: null,
    30002613: "jlm-ras-al-amud",
    30002711: "jlm-jabel-mukaber",
    30002811: "jlm-sur-baher",
    30002911: "jlm-beit-safafa",
  },
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isClean = (s: unknown): s is string => typeof s === "string" && !s.includes("�") && !s.includes("�");
const cleanQ = (s: string) => s.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
/** Normalize a Hebrew area/neighborhood name to a core for matching. */
const core = (s: string) =>
  cleanQ(s)
    .replace(/\((צפון|דרום|מזרח|מערב|מרכז|צפון-מערב|דרום-מזרח|מרכז וצפון)\)/g, "")
    .replace(/[()]/g, "")
    .replace(/\b(רובע|שכונת|שיכון)\b/g, "")
    .replace(/\s+(צפון|דרום|מזרח|מערב|מרכז)\b/g, "")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .replace(/^ה/, "")
    .trim();
const isNonResidential = (name: string) => /תעשי|מסחר|לוגיסטי|מב"?ת|מב''ת/.test(name);

type Row = Record<string, unknown>;

async function main() {
  const cityArg = (() => {
    const i = process.argv.indexOf("--city");
    return i >= 0 ? process.argv[i + 1] : "modiin";
  })();
  const city = CITIES[cityArg];
  if (!city) {
    console.error(`Unknown city "${cityArg}". Known: ${Object.keys(CITIES).join(", ")}`);
    process.exit(1);
  }
  const override = CROSSWALKS[city.id] ?? {};
  const demoFile = city.demographicsOut ?? `${city.id}.demographics.json`;
  const outName = city.crimeOut ?? `${city.id}.crime.json`;

  const geo = JSON.parse(readFileSync(resolve(process.cwd(), city.outFile), "utf8")) as {
    features: Array<{ properties: { id: string; name_he: string } }>;
  };
  const nbs = geo.features.map((f) => ({ id: f.properties.id, coreName: core(f.properties.name_he) }));
  const autoMatch = (name: string): string | null => {
    const cn = core(name);
    if (!cn) return null;
    let best: string | null = null, len = 0;
    for (const nb of nbs) {
      if (nb.coreName.length < 3) continue;
      if ((cn.includes(nb.coreName) || nb.coreName.includes(cn)) && nb.coreName.length > len) {
        best = nb.id; len = nb.coreName.length;
      }
    }
    return best;
  };

  console.log(`→ fetching Police crime records for ${city.id} (YeshuvKod=${city.semelYishuv})…`);
  const url =
    "https://data.gov.il/api/3/action/datastore_search?resource_id=5fc13c50-b6f3-4712-b831-a75e0f91a17e&limit=40000&filters=" +
    encodeURIComponent(JSON.stringify({ YeshuvKod: String(city.semelYishuv) }));
  const res = await fetch(url, { headers: { "User-Agent": "MishpachaMap/0.1", Accept: "application/json" } });
  if (!res.ok) throw new Error(`CKAN: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { success: boolean; result?: { records: Row[] } };
  if (!json.success || !json.result) throw new Error("CKAN success=false");
  const rows = json.result.records;
  console.log(`  ${rows.length} case rows`);

  // Offense-group classification (person vs property).
  const groupName = new Map<number, string>();
  for (const r of rows) {
    const k = num(r.StatisticGroupKod);
    if (k != null && isClean(r.StatisticGroup) && !groupName.has(k)) groupName.set(k, r.StatisticGroup as string);
  }
  const isPerson = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && (n.includes("גוף") || n.includes("מין") || n.includes("נגד אדם"));
  };
  const isProperty = (k: number | null) => {
    const n = k != null ? groupName.get(k) : undefined;
    return !!n && n.includes("רכוש");
  };

  // First clean name per area code (for auto-match + reporting).
  const areaName = new Map<number, string>();
  for (const r of rows) {
    const code = num(r.StatisticAreaKod);
    if (code != null && isClean(r.StatisticArea) && !areaName.has(code)) areaName.set(code, cleanQ(r.StatisticArea as string));
  }

  // Resolve each area code → neighborhood (override > industrial > auto-match).
  const areaToNb = new Map<number, string | null>();
  for (const code of areaName.keys()) {
    if (code in override) { areaToNb.set(code, override[code]); continue; }
    const name = areaName.get(code) ?? "";
    if (!code || isNonResidential(name)) { areaToNb.set(code, null); continue; }
    areaToNb.set(code, autoMatch(name));
  }

  type Agg = { total: number; person: number; property: number; areas: Set<number> };
  const agg = new Map<string, Agg>();
  const unmapped = new Set<number>();
  for (const r of rows) {
    const code = num(r.StatisticAreaKod);
    if (code == null || code === 0) continue; // city-wide / unassigned
    const nb = code in override ? override[code] : areaToNb.get(code);
    if (nb == null) { if (!(code in override) && !isNonResidential(areaName.get(code) ?? "")) unmapped.add(code); continue; }
    const a = agg.get(nb) ?? { total: 0, person: 0, property: 0, areas: new Set() };
    a.total += 1;
    const gk = num(r.StatisticGroupKod);
    if (isPerson(gk)) a.person += 1;
    else if (isProperty(gk)) a.property += 1;
    a.areas.add(code);
    agg.set(nb, a);
  }
  if (unmapped.size) {
    console.warn(`  ⚠ ${unmapped.size} area codes didn't match a neighborhood (skipped):`);
    for (const c of unmapped) console.warn(`     ${c}  ${areaName.get(c) ?? ""}`);
  }

  const demo = JSON.parse(readFileSync(resolve(process.cwd(), "public", demoFile), "utf8")) as {
    neighborhoods: Record<string, { population?: number } | null>;
  };

  // A reported-crime rate this high (per 1,000 residents) is implausible for a
  // residential neighborhood and signals a denominator mismatch — the police
  // area covers materially more people than the CBS neighborhood's census pop.
  // We suppress those (honest "no data") rather than publish a misleading floor.
  const MAX_PLAUSIBLE_RATE = 70;
  const rate = new Map<string, number>();
  const suppressed: Array<[string, number]> = [];
  for (const [nb, a] of agg) {
    const pop = demo.neighborhoods[nb]?.population ?? null;
    if (!pop || pop <= 0) continue;
    const per1000 = (a.total / pop) * 1000;
    if (per1000 > MAX_PLAUSIBLE_RATE) { suppressed.push([nb, per1000]); continue; }
    rate.set(nb, per1000);
  }
  if (suppressed.length) {
    console.warn(`  ⚠ suppressed ${suppressed.length} (rate > ${MAX_PLAUSIBLE_RATE}/1000 — police area ≠ census pop): ${suppressed.map(([n, r]) => `${n}(${r.toFixed(0)})`).join(", ")}`);
  }
  const ordered = [...rate.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  const rankOf = (nb: string) => ordered.indexOf(nb) + 1;
  // Absolute (not percentile) so a safe city stays safe. ~4/1000→~94, ~33/1000→~47.
  const scoreOf = (per1000: number) => Math.round(Math.min(98, Math.max(40, 100 - per1000 * 1.6)));

  const out: Record<string, unknown> = {};
  for (const f of geo.features) {
    const id = f.properties.id;
    const a = agg.get(id);
    const per1000 = a ? rate.get(id) ?? null : null;
    if (!a || per1000 == null) { out[id] = null; continue; } // no coverage or suppressed (implausible)
    out[id] = {
      name_he: f.properties.name_he,
      cases_2024_total: a.total,
      cases_2024_person: a.person,
      cases_2024_property: a.property,
      per_1000_residents: per1000 != null ? Math.round(per1000 * 10) / 10 : null,
      safety_score: per1000 != null ? scoreOf(per1000) : null,
      safety_rank: per1000 != null ? rankOf(id) : null,
      safety_rank_of: ordered.length,
      source: {
        provider: "Israel Police crime_records_data (data.gov.il 5fc13c50)",
        period: "2024",
        note: "reported cases; residential safety approx; commercial areas excluded; name-matched to the police area scheme",
        police_areas: [...a.areas].sort(),
      },
    };
  }

  writeFileSync(
    resolve(process.cwd(), "public", outName),
    JSON.stringify({ meta: { source: "Israel Police 2024", resource: "5fc13c50-b6f3-4712-b831-a75e0f91a17e", locality: city.semelYishuv }, neighborhoods: out }, null, 2) + "\n",
    "utf8",
  );

  console.log("\nneighborhood            cases  /1000  safety   police-areas");
  const covered = Object.entries(out).filter(([, v]) => v) as [string, { cases_2024_total: number; per_1000_residents: number; safety_score: number; source: { police_areas: number[] } }][];
  covered.sort((a, b) => b[1].safety_score - a[1].safety_score);
  for (const [id, v] of covered) {
    console.log(`  ${id.padEnd(22)} ${String(v.cases_2024_total).padStart(4)}  ${String(v.per_1000_residents).padStart(5)}  ${String(v.safety_score).padStart(3)}     ${v.source.police_areas.join(",")}`);
  }
  const nulls = Object.entries(out).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n○ no crime-area coverage (honest null): ${nulls.join(", ") || "(none)"}`);
  console.log(`→ wrote public/${outName} — ${covered.length}/${geo.features.length} covered`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Knesset election results per neighborhood.
 *
 *   pnpm ingest:elections                     # seed parties + Knesset 25 election shell
 *   pnpm ingest:elections -- <csv-file>       # load aggregated CSV: neighborhood,party,votes
 *   pnpm ingest:elections -- <csv> --election=knesset-25 --replace
 *
 * The CSV is the per-neighborhood aggregation. To produce it from the
 * bechirot.gov.il per-station file you need a station→neighborhood mapping
 * (PostGIS ST_Contains on the polling-place address). For V1 we accept the
 * pre-aggregated file directly — easy to hand-curate for Modi'in's 14
 * neighborhoods × ~10 major parties.
 *
 * CSV format (header row required):
 *   neighborhood,party,votes
 *   hashvatim,likud,420
 *   hashvatim,yeshatid,610
 *   ...
 *
 * `neighborhood` matches by id, name_he, or alias. `party` matches by id from
 * the PARTIES catalog below.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sb } from "./_env";
import { parseCsv } from "../../lib/csv";

const ELECTIONS = [
  { id: "knesset-25", name_he: "כנסת ה-25", date: "2022-11-01" },
];

/**
 * Catalog of major Israeli parties. `color` is the party's recognised brand
 * color (mostly drawn from their official sites / Wikipedia infoboxes). Used
 * by the right-rail stacked bar.
 *
 * Add new parties (e.g. for 26th Knesset) by appending here — id stays
 * stable across cycles (renames go in name_he only).
 */
const PARTIES = [
  { id: "likud",            name_he: "הליכוד",                 name_en: "Likud",                 color: "#2D4373" },
  { id: "yeshatid",         name_he: "יש עתיד",                name_en: "Yesh Atid",             color: "#1E88E5" },
  { id: "religious_zionism", name_he: "הציונות הדתית",         name_en: "Religious Zionism",     color: "#E2A700" },
  { id: "national_unity",   name_he: "המחנה הממלכתי",          name_en: "National Unity",        color: "#00B0AC" },
  { id: "shas",             name_he: 'ש"ס',                    name_en: "Shas",                  color: "#1A1A1A" },
  { id: "utj",              name_he: "יהדות התורה",            name_en: "United Torah Judaism",  color: "#4A4A4A" },
  { id: "israel_beytenu",   name_he: "ישראל ביתנו",            name_en: "Yisrael Beytenu",       color: "#E54B4B" },
  { id: "labor",            name_he: "העבודה",                 name_en: "Labor",                 color: "#B22222" },
  { id: "raam",             name_he: "רע\"מ",                  name_en: "Ra'am",                 color: "#1B5E20" },
  { id: "hadash_taal",      name_he: "חד\"ש-תע\"ל",            name_en: "Hadash-Ta'al",          color: "#226B22" },
  { id: "meretz",           name_he: "מרצ",                    name_en: "Meretz",                color: "#4DAF4A" },
  { id: "other",            name_he: "אחרים",                  name_en: "Other",                 color: "#84888E" },
];

type Args = {
  file: string | null;
  election: string;
  replace: boolean;
  seedMock: boolean;
};

function parseArgs(argv: string[]): Args {
  let file: string | null = null;
  let election = "knesset-25";
  let replace = false;
  let seedMock = false;
  for (const a of argv) {
    if (a.startsWith("--election=")) election = a.slice("--election=".length);
    else if (a === "--replace") replace = true;
    else if (a === "--seed-mock") seedMock = true;
    else if (!a.startsWith("--")) file = a;
  }
  return { file, election, replace, seedMock };
}

/**
 * Plausible Knesset 25 distributions per neighborhood — estimates based on
 * each neighborhood's known character, NOT official bechirot.gov.il data.
 * Replace with real numbers via the CSV / stations ingest paths.
 */
const MOCK_RESULTS: Record<string, Record<string, number>> = {
  // Religious — lean Religious Zionism + Shas/UTJ
  hashvatim: { religious_zionism: 720, yeshatid: 410, likud: 380, shas: 220, utj: 180, national_unity: 140, israel_beytenu: 60, labor: 40 },
  moriah:    { religious_zionism: 680, likud: 410, yeshatid: 360, shas: 200, utj: 160, national_unity: 130, israel_beytenu: 50, labor: 30 },
  // Central / secular — Yesh Atid + Likud dominant
  hakramim:  { yeshatid: 780, likud: 540, national_unity: 320, labor: 180, meretz: 120, israel_beytenu: 110, religious_zionism: 90, shas: 40 },
  haprachim: { yeshatid: 720, likud: 580, national_unity: 290, labor: 150, israel_beytenu: 130, meretz: 90, religious_zionism: 80, shas: 30 },
  hanechalim:{ yeshatid: 700, likud: 560, national_unity: 280, labor: 140, israel_beytenu: 120, meretz: 100, religious_zionism: 70, shas: 30 },
  hatsiporim:{ yeshatid: 740, likud: 520, national_unity: 300, labor: 160, israel_beytenu: 110, meretz: 110, religious_zionism: 70 },
  // Family / community — Yesh Atid lead, mixed
  nofim:     { yeshatid: 690, likud: 510, national_unity: 280, labor: 140, israel_beytenu: 120, religious_zionism: 90, meretz: 70 },
  hanevim:   { yeshatid: 660, likud: 480, national_unity: 270, labor: 130, israel_beytenu: 130, religious_zionism: 80, meretz: 70 },
  hameginim: { yeshatid: 640, likud: 470, national_unity: 260, labor: 120, israel_beytenu: 120, religious_zionism: 100, meretz: 70 },
  avneichen: { yeshatid: 620, likud: 500, national_unity: 240, israel_beytenu: 140, labor: 110, religious_zionism: 100, meretz: 60 },
  // Security families / quieter — Likud + National Unity + Beytenu lean
  hareut:    { likud: 540, yeshatid: 420, national_unity: 310, israel_beytenu: 180, religious_zionism: 140, labor: 100, meretz: 40 },
  hamakkabim:{ likud: 520, yeshatid: 410, national_unity: 320, israel_beytenu: 200, religious_zionism: 130, labor: 90 },
  // West / newer
  masuah:    { yeshatid: 580, likud: 490, national_unity: 270, religious_zionism: 180, israel_beytenu: 120, labor: 100, shas: 60 },
  moreshet:  { likud: 520, yeshatid: 470, national_unity: 280, religious_zionism: 220, israel_beytenu: 140, labor: 90 },
};

async function seedMockResults(electionId: string, replace: boolean) {
  console.log(`→ seeding mock Knesset 25 distributions for ${Object.keys(MOCK_RESULTS).length} neighborhoods…`);
  console.warn("  ⚠ ESTIMATES, not official. Replace with real CSV from bechirot.gov.il when available.");

  // Filter to neighborhoods that actually exist in this DB (so a stale
  // MOCK_RESULTS entry doesn't break the upsert with a FK violation).
  const { data: knownNbs, error: nbErr } = await sb.from("neighborhoods").select("id");
  if (nbErr) throw new Error(`load neighborhoods: ${nbErr.message}`);
  const knownIds = new Set((knownNbs ?? []).map((n) => n.id as string));

  type Row = { neighborhood: string; election: string; party: string; votes: number; pct: number };
  const rows: Row[] = [];
  for (const [nbId, weights] of Object.entries(MOCK_RESULTS)) {
    if (!knownIds.has(nbId)) {
      console.warn(`  · skipping ${nbId}: not in neighborhoods table`);
      continue;
    }
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    if (total === 0) continue;
    for (const [partyId, votes] of Object.entries(weights)) {
      rows.push({
        neighborhood: nbId,
        election: electionId,
        party: partyId,
        votes,
        pct: Number(((votes / total) * 100).toFixed(2)),
      });
    }
  }

  if (replace) {
    const { error } = await sb.from("neighborhood_election_results").delete().eq("election", electionId);
    if (error) throw new Error(`delete: ${error.message}`);
    console.log(`✓ cleared previous results for election=${electionId}`);
  }

  const { error } = await sb.from("neighborhood_election_results").upsert(rows);
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log(`✓ inserted ${rows.length} mock (neighborhood × party) rows`);
}

async function seedCatalog() {
  console.log("→ upserting elections + parties catalog…");
  const { error: e1 } = await sb.from("elections").upsert(ELECTIONS);
  if (e1) throw new Error(`elections upsert: ${e1.message}`);
  const { error: e2 } = await sb.from("parties").upsert(PARTIES);
  if (e2) throw new Error(`parties upsert: ${e2.message}`);
  console.log(`✓ ${ELECTIONS.length} elections, ${PARTIES.length} parties`);
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function loadNeighborhoodIndex(): Promise<Map<string, string>> {
  const { data, error } = await sb.from("neighborhoods").select("id, name_he, aliases");
  if (error) throw new Error(error.message);
  const index = new Map<string, string>();
  for (const n of data ?? []) {
    const id = n.id as string;
    index.set(id.toLowerCase(), id);
    if (n.name_he) index.set(normalise(n.name_he as string), id);
    for (const a of (n.aliases as string[] | null) ?? []) {
      index.set(normalise(a), id);
    }
  }
  return index;
}

async function ingestCsv(args: Args) {
  if (!args.file) return;
  const filePath = resolve(process.cwd(), args.file);
  console.log(`→ reading ${filePath}`);
  const text = readFileSync(filePath, "utf8");
  const grid = parseCsv(text);
  if (grid.length < 2) throw new Error("CSV has no data rows");
  const [headers, ...rows] = grid;
  const cols = {
    neighborhood: headers.findIndex((h) => /^(neighborhood|שכונה)$/i.test(h.trim())),
    party: headers.findIndex((h) => /^(party|מפלגה)$/i.test(h.trim())),
    votes: headers.findIndex((h) => /^(votes|קולות)$/i.test(h.trim())),
  };
  for (const [k, idx] of Object.entries(cols)) {
    if (idx < 0) throw new Error(`Missing required column "${k}"`);
  }
  const nbIndex = await loadNeighborhoodIndex();
  const partyIds = new Set(PARTIES.map((p) => p.id));

  type Row = { neighborhood: string; election: string; party: string; votes: number };
  const accepted: Row[] = [];
  const skipped: string[] = [];

  for (let r = 0; r < rows.length; r++) {
    const raw = rows[r];
    const nbRaw = raw[cols.neighborhood]?.trim();
    const partyRaw = raw[cols.party]?.trim().toLowerCase();
    const votes = Number(raw[cols.votes]?.replace(/[, ]/g, ""));
    if (!nbRaw || !partyRaw || !Number.isFinite(votes)) {
      skipped.push(`line ${r + 2}: missing field`);
      continue;
    }
    const nbId = nbIndex.get(normalise(nbRaw));
    if (!nbId) {
      skipped.push(`line ${r + 2}: unknown neighborhood "${nbRaw}"`);
      continue;
    }
    if (!partyIds.has(partyRaw)) {
      skipped.push(`line ${r + 2}: unknown party id "${partyRaw}"`);
      continue;
    }
    accepted.push({ neighborhood: nbId, election: args.election, party: partyRaw, votes });
  }

  // Compute pct per (neighborhood, election).
  const totals = new Map<string, number>();
  for (const r of accepted) {
    const k = `${r.neighborhood}|${r.election}`;
    totals.set(k, (totals.get(k) ?? 0) + r.votes);
  }
  const enriched = accepted.map((r) => {
    const total = totals.get(`${r.neighborhood}|${r.election}`) ?? 0;
    return { ...r, pct: total > 0 ? Number(((r.votes / total) * 100).toFixed(2)) : 0 };
  });

  console.log(`✓ parsed ${enriched.length} rows (${skipped.length} skipped)`);
  if (skipped.length > 0 && skipped.length <= 20) {
    for (const s of skipped) console.warn(`  · ${s}`);
  }
  if (enriched.length === 0) return;

  if (args.replace) {
    const { error } = await sb
      .from("neighborhood_election_results")
      .delete()
      .eq("election", args.election);
    if (error) throw new Error(`delete: ${error.message}`);
    console.log(`✓ cleared existing rows for election=${args.election}`);
  }

  const { error } = await sb.from("neighborhood_election_results").upsert(enriched);
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log(`✓ inserted ${enriched.length} (neighborhood × party) rows`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await seedCatalog();
  if (args.seedMock) {
    await seedMockResults(args.election, args.replace);
    return;
  }
  if (args.file) await ingestCsv(args);
  else console.log("Pass --seed-mock for estimates, or a CSV path for real data: pnpm ingest:elections -- data/elections/knesset-25.csv");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

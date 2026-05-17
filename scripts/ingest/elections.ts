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
};

function parseArgs(argv: string[]): Args {
  let file: string | null = null;
  let election = "knesset-25";
  let replace = false;
  for (const a of argv) {
    if (a.startsWith("--election=")) election = a.slice("--election=".length);
    else if (a === "--replace") replace = true;
    else if (!a.startsWith("--")) file = a;
  }
  return { file, election, replace };
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
  if (args.file) await ingestCsv(args);
  else console.log("Pass a CSV path to ingest results, e.g. pnpm ingest:elections -- data/elections/knesset-25.csv");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

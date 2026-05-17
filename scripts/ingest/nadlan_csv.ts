/**
 * CSV-based Nadlan ingest. Until we have a working data.gov.il endpoint,
 * users export a transactions CSV from nadlan.gov.il (or a municipal source)
 * and run this script to land it in the `transactions` table.
 *
 * Usage:
 *   pnpm ingest:nadlan:csv -- data/nadlan/2025.csv
 *   pnpm ingest:nadlan:csv -- data/nadlan/2025.csv --neighborhood=hashvatim
 *   pnpm ingest:nadlan:csv -- data/nadlan/2025.csv --source=nadlan-2025-q1 --replace
 *
 * The CSV needs at minimum: price, sqm, rooms, transaction date, and one of
 *   (a) a neighborhood column whose value matches a row in `neighborhoods`
 *       by id, name_he, or alias, OR
 *   (b) a `--neighborhood=<id>` arg applied to every row in the file.
 *
 * Recognised header names (case + whitespace insensitive):
 *   neighborhood: שכונה | neighborhood | nbhd
 *   address:      כתובת | address
 *   rooms:        חדרים | rooms
 *   sqm:          שטח | מ"ר | sqm | area
 *   price:        מחיר | price | price_nis
 *   date:         תאריך | date | tx_date | sale_date
 *
 * Rows with unparseable price/sqm/date are skipped (counted, not aborted).
 * Pass --replace to delete prior rows with the same `source` before insert.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sb } from "./_env";

type Row = {
  neighborhood: string;
  address: string | null;
  rooms: number | null;
  sqm: number;
  price_nis: number;
  price_per_m2: number;
  tx_date: string;
  source: string;
};

type Args = {
  file: string;
  neighborhoodOverride: string | null;
  source: string;
  replace: boolean;
};

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let neighborhoodOverride: string | null = null;
  let source = "nadlan-csv";
  let replace = false;
  for (const a of argv) {
    if (a.startsWith("--neighborhood=")) neighborhoodOverride = a.slice("--neighborhood=".length);
    else if (a.startsWith("--source=")) source = a.slice("--source=".length);
    else if (a === "--replace") replace = true;
    else if (!a.startsWith("--")) positional.push(a);
  }
  if (positional.length === 0) {
    throw new Error("Usage: pnpm ingest:nadlan:csv -- <path-to-csv> [--neighborhood=<id>] [--source=<tag>] [--replace]");
  }
  return { file: positional[0], neighborhoodOverride, source, replace };
}

/**
 * Minimal CSV parser. Handles quoted fields ("a,b","c"), escaped quotes
 * (""), and CRLF/LF line endings. Not RFC 4180 complete (no streaming, no
 * BOM stripping beyond a single leading 0xFEFF) — sufficient for the
 * known-good government exports we're targeting.
 */
function parseCsv(input: string): string[][] {
  let i = 0;
  const len = input.length;
  if (len > 0 && input.charCodeAt(0) === 0xfeff) i = 1; // BOM
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      out.push(row);
      row = [];
      // Swallow a paired LF after CR.
      if (ch === "\r" && input[i + 1] === "\n") i += 2;
      else i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Trailing field / row (no terminator).
  if (field !== "" || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_ALIASES: Record<keyof Omit<Row, "source" | "price_per_m2">, string[]> = {
  neighborhood: ["שכונה", "neighborhood", "nbhd"],
  address: ["כתובת", "כתובת הנכס", "address"],
  rooms: ["חדרים", "מס חדרים", "מספר חדרים", "rooms"],
  sqm: ["שטח", "שטח במ\"ר", "מ\"ר", "sqm", "area"],
  price_nis: ["מחיר", "מחיר בשקלים", "price", "price_nis"],
  tx_date: ["תאריך", "תאריך עסקה", "date", "tx_date", "sale_date"],
};

function normaliseHeader(h: string): string {
  return h.replace(/[\s ]+/g, " ").trim().toLowerCase();
}

function buildHeaderMap(headers: string[]): Partial<Record<keyof typeof HEADER_ALIASES, number>> {
  const norm = headers.map(normaliseHeader);
  const out: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]) {
    const candidates = HEADER_ALIASES[key].map(normaliseHeader);
    const idx = norm.findIndex((h) => candidates.includes(h));
    if (idx >= 0) out[key] = idx;
  }
  return out;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[,\s₪]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Accept ISO (YYYY-MM-DD), DD/MM/YYYY, DD.MM.YYYY. Returns YYYY-MM-DD. */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const m = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  let yyyy = m[3];
  if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? "19" : "20") + yyyy;
  return `${yyyy}-${mm}-${dd}`;
}

async function loadNeighborhoodIndex(): Promise<Map<string, string>> {
  // Build a lookup: normalised-name → canonical id. Keys include the id
  // itself, the Hebrew name, and every alias.
  const { data, error } = await sb.from("neighborhoods").select("id, name_he, aliases");
  if (error) throw new Error(`Failed to load neighborhoods: ${error.message}`);
  const index = new Map<string, string>();
  for (const n of data ?? []) {
    const id = n.id as string;
    index.set(id.toLowerCase(), id);
    if (n.name_he) index.set(normaliseHeader(n.name_he as string), id);
    for (const a of (n.aliases as string[] | null) ?? []) {
      index.set(normaliseHeader(a), id);
    }
  }
  return index;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = resolve(process.cwd(), args.file);
  console.log(`→ reading ${filePath}`);
  const text = readFileSync(filePath, "utf8");
  const grid = parseCsv(text);
  if (grid.length < 2) {
    console.error("CSV is empty or has no data rows.");
    process.exitCode = 1;
    return;
  }
  const [headers, ...dataRows] = grid;
  const cols = buildHeaderMap(headers);
  for (const required of ["sqm", "price_nis", "tx_date"] as const) {
    if (cols[required] === undefined) {
      console.error(`Missing required column for "${required}". Recognised header aliases: ${HEADER_ALIASES[required].join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }
  if (args.neighborhoodOverride === null && cols.neighborhood === undefined) {
    console.error('No neighborhood column found. Either add a "שכונה"/"neighborhood" column or pass --neighborhood=<id>.');
    process.exitCode = 1;
    return;
  }

  const nbIndex = await loadNeighborhoodIndex();
  if (args.neighborhoodOverride && !nbIndex.has(args.neighborhoodOverride.toLowerCase())) {
    console.error(`Unknown --neighborhood="${args.neighborhoodOverride}". Known ids: ${Array.from(new Set(nbIndex.values())).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const rows: Row[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const raw = dataRows[r];
    const line = r + 2; // human-friendly (1-indexed, header is line 1)
    const price = parseNumber(raw[cols.price_nis!]);
    const sqm = parseNumber(raw[cols.sqm!]);
    const date = parseDate(raw[cols.tx_date!]);
    if (price == null || sqm == null || date == null || sqm <= 0) {
      skipped.push({ line, reason: "missing or unparseable price/sqm/date" });
      continue;
    }
    let nbId: string | undefined;
    if (args.neighborhoodOverride) {
      nbId = nbIndex.get(args.neighborhoodOverride.toLowerCase());
    } else {
      const raw_nb = raw[cols.neighborhood!]?.trim();
      if (raw_nb) nbId = nbIndex.get(normaliseHeader(raw_nb));
    }
    if (!nbId) {
      skipped.push({ line, reason: `neighborhood "${raw[cols.neighborhood!] ?? ""}" not in registry` });
      continue;
    }
    rows.push({
      neighborhood: nbId,
      address: cols.address !== undefined ? raw[cols.address]?.trim() || null : null,
      rooms: cols.rooms !== undefined ? parseNumber(raw[cols.rooms]) : null,
      sqm,
      price_nis: price,
      price_per_m2: Math.round(price / sqm),
      tx_date: date,
      source: args.source,
    });
  }

  console.log(`✓ parsed ${rows.length} rows (${skipped.length} skipped, source=${args.source})`);
  if (skipped.length > 0 && skipped.length <= 20) {
    for (const s of skipped) console.warn(`  · line ${s.line}: ${s.reason}`);
  }

  if (rows.length === 0) {
    console.warn("Nothing to insert.");
    return;
  }

  if (args.replace) {
    const { error } = await sb.from("transactions").delete().eq("source", args.source);
    if (error) {
      console.error(`Failed to clear prior source=${args.source}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ cleared previous source=${args.source}`);
  }

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("transactions").insert(slice);
    if (error) {
      console.error(`Insert error at offset ${i}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`✓ inserted ${rows.length} transactions. Re-run pnpm metrics:recompute to update neighborhood_metrics.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

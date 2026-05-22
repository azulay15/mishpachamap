/**
 * Stage 1 of the elections-station ingest pipeline.
 *
 * Reads the CEC's "kalpiplaces" XLSX (polling station addresses for a given
 * Knesset cycle) and emits a CSV with one row per station for a single
 * locality. The CSV is the input to elections_geocode_stations.ts.
 *
 * Source: snapshot vendored from https://github.com/JacobWeinbren/Israel-Revised
 * (data/25/kalpiplaces_kalpieslist_27-10.xlsx). For K26+ we'll need to source
 * directly from CEC once their archive site comes back online.
 *
 * Usage:
 *   npm run ingest:elections:extract -- [--xlsx=path] [--city=1200] [--out=path]
 *
 * Defaults: data/elections/kalpiplaces_k25.xlsx, city 1200 (Modi'in-Maccabim-
 * Re'ut), out = data/elections/stations_<city>_k25.csv.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import * as XLSX from "xlsx";

type Args = {
  xlsxPath: string;
  cityCode: string;
  outPath: string;
};

function parseArgs(argv: string[]): Args {
  let xlsxPath = "data/elections/kalpiplaces_k25.xlsx";
  let cityCode = "1200";
  let outPath = "";
  for (const a of argv) {
    if (a.startsWith("--xlsx=")) xlsxPath = a.slice("--xlsx=".length);
    else if (a.startsWith("--city=")) cityCode = a.slice("--city=".length);
    else if (a.startsWith("--out=")) outPath = a.slice("--out=".length);
  }
  if (!outPath) outPath = `data/elections/stations_${cityCode}_k25.csv`;
  return { xlsxPath, cityCode, outPath };
}

/** Find a header column by trying several aliases. */
function findCol(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) => h.replace(/\s+/g, " ").trim());
  for (const a of aliases) {
    const i = norm.findIndex((h) => h === a);
    if (i >= 0) return i;
  }
  return -1;
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const xlsxAbsPath = resolve(process.cwd(), args.xlsxPath);
  console.log(`→ reading ${xlsxAbsPath}`);

  const wb = XLSX.read(readFileSync(xlsxAbsPath), { type: "buffer" });

  // The kalpiplaces XLSX has two sheets; the first is the actual data and
  // the second is metadata. Pick the sheet with the most rows that contains
  // a station-number column.
  let best: { name: string; rows: string[][]; headers: string[] } | null = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (grid.length < 2) continue;
    const headers = grid[0].map((c) => String(c));
    const stationIdx = findCol(headers, ["מספר קלפי", "סמל קלפי", "קלפי"]);
    if (stationIdx >= 0 && (!best || grid.length > best.rows.length)) {
      best = { name, rows: grid.slice(1) as string[][], headers };
    }
  }
  if (!best) {
    throw new Error("could not find a sheet with a 'מספר קלפי' column");
  }
  console.log(`  using sheet '${best.name}' (${best.rows.length} rows)`);

  const cityIdx = findCol(best.headers, ["סמל ישוב", "קוד עיר"]);
  const stationIdx = findCol(best.headers, ["מספר קלפי", "סמל קלפי", "קלפי"]);
  // Headers vary between releases — try several aliases for each.
  const placeIdx = findCol(best.headers, [
    "מקום קלפי",
    "שם מקום",
    "מקום",
    "שם בית הספר",
    "סוג מקום",
  ]);
  const streetIdx = findCol(best.headers, [
    "כתובת",
    "רחוב",
    "רחוב ומספר",
    "כתובת קלפי",
  ]);
  const cityNameIdx = findCol(best.headers, ["שם ישוב", "ישוב"]);
  if (cityIdx < 0 || stationIdx < 0) {
    throw new Error(
      `need columns 'סמל ישוב' and 'מספר קלפי' (got: ${best.headers.join(", ")})`,
    );
  }

  const rows = best.rows.filter((r) => String(r[cityIdx] ?? "").trim() === args.cityCode);
  console.log(`  ${rows.length} rows for city ${args.cityCode}`);

  if (rows.length === 0) {
    console.log("  (no rows — verify the city code and XLSX file)");
    process.exitCode = 1;
    return;
  }

  // Output: stable column set the geocoder script expects. The "קלפי"
  // header aligns with elections_stations.ts (which already accepts it).
  const outRows: string[] = [
    "קלפי,city_code,city_name,place_name,street",
  ];
  for (const r of rows) {
    outRows.push(
      [
        r[stationIdx],
        r[cityIdx],
        cityNameIdx >= 0 ? r[cityNameIdx] : "",
        placeIdx >= 0 ? r[placeIdx] : "",
        streetIdx >= 0 ? r[streetIdx] : "",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const outAbsPath = resolve(process.cwd(), args.outPath);
  mkdirSync(dirname(outAbsPath), { recursive: true });
  writeFileSync(outAbsPath, "﻿" + outRows.join("\n"), "utf8");
  console.log(`✓ wrote ${outRows.length - 1} stations to ${args.outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

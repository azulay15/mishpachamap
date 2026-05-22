import { sb } from "../ingest/_env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  // What schools do we have in Modi'in?
  const { data: schools, error: serr } = await sb
    .from("schools")
    .select("id, name_he");
  if (serr) {
    console.log("schools err:", serr);
    return;
  }
  console.log(`schools in DB: ${schools?.length ?? 0}`);
  for (const s of (schools ?? []).slice(0, 10)) {
    console.log(`  ${s.id.padEnd(20)} ${s.name_he}`);
  }

  // Read the extracted stations CSV.
  const csv = readFileSync(
    resolve(process.cwd(), "data/elections/stations_1200_k25.csv"),
    "utf8",
  );
  const lines = csv.replace(/^﻿/, "").trim().split("\n");
  const headers = lines[0].split(",");
  const placeIdx = headers.indexOf("place_name");

  const placeNames = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    // crude split because the CSV has quoted fields — works for our purposes
    const cells = lines[i].split(",");
    const place = cells[placeIdx]?.replace(/"/g, "").trim();
    if (place) placeNames.add(place);
  }
  console.log(`\nunique station place_names: ${placeNames.size}`);
  for (const p of [...placeNames].slice(0, 15)) console.log(`  ${p}`);
}

main();

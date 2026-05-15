/**
 * V1 placeholder: generate plausible synthetic transactions per Modi'in /
 * Maccabim / Re'ut neighborhood so `compute_metrics` produces real-looking
 * numbers.
 *
 * Tagged `source='synthetic-v1'`. To remove later:
 *   delete from transactions where source = 'synthetic-v1';
 *
 * TODO(post-V1): replace with a real data.gov.il / Nadlan ingest. The previous
 * implementation against nadlan.gov.il returned the SPA bootstrap HTML — the
 * endpoint moved or is now gated. Likely future paths:
 *   - data.gov.il CKAN datastore_search (Nadlan deals dataset)
 *   - Tax Authority Nadlan dataset direct query
 */
import { sb } from "./_env";

type Profile = { id: string; avgPpm: number; medianRooms: number };

const PROFILES: Profile[] = [
  { id: "hareut",     avgPpm: 31000, medianRooms: 5 },
  { id: "hamakkabim", avgPpm: 36000, medianRooms: 6 },
  { id: "masuah",     avgPpm: 33000, medianRooms: 5 },
  { id: "avneichen",  avgPpm: 28500, medianRooms: 4 },
  { id: "nofim",      avgPpm: 28700, medianRooms: 4 },
  { id: "haprachim",  avgPpm: 29000, medianRooms: 4 },
  { id: "hanechalim", avgPpm: 27500, medianRooms: 4 },
  { id: "hakramim",   avgPpm: 30100, medianRooms: 5 },
  { id: "hashvatim",  avgPpm: 35000, medianRooms: 6 },
  { id: "moriah",     avgPpm: 34200, medianRooms: 5 },
  { id: "hanevim",    avgPpm: 28000, medianRooms: 4 },
  { id: "hameginim",  avgPpm: 27000, medianRooms: 4 },
  { id: "hatsiporim", avgPpm: 32500, medianRooms: 5 },
  { id: "moreshet",   avgPpm: 30500, medianRooms: 5 },
];

const TX_PER_NEIGHBORHOOD = 60;
const MONTHS_BACK = 24;

function gaussian(): number {
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randInt(min: number, maxInclusive: number): number {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

function pickDate(): string {
  const today = new Date();
  const offsetDays = randInt(1, MONTHS_BACK * 30);
  const d = new Date(today);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function generateRow(p: Profile) {
  const rooms = Math.max(3, Math.min(7, p.medianRooms + randInt(-1, 1)));
  const sqm = Math.round(rooms * (28 + Math.random() * 6));
  const ppm = Math.round(p.avgPpm * (1 + gaussian() * 0.1));
  const price = ppm * sqm;
  return {
    neighborhood: p.id,
    address: null,
    point: null,
    rooms,
    sqm,
    price_nis: price,
    price_per_m2: ppm,
    tx_date: pickDate(),
    source: "synthetic-v1",
  };
}

async function main() {
  const rows: ReturnType<typeof generateRow>[] = [];
  for (const p of PROFILES) {
    for (let i = 0; i < TX_PER_NEIGHBORHOOD; i++) {
      rows.push(generateRow(p));
    }
  }
  console.log(`→ inserting ${rows.length} synthetic transactions (source='synthetic-v1')…`);

  const { error: deleteErr } = await sb.from("transactions").delete().eq("source", "synthetic-v1");
  if (deleteErr) {
    console.error("  cleanup error:", deleteErr.message);
    process.exitCode = 1;
    return;
  }

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from("transactions").insert(slice);
    if (error) {
      console.error("  insert error:", error.message);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`✓ done (${rows.length} synthetic transactions; replace with real Nadlan ingest post-V1)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

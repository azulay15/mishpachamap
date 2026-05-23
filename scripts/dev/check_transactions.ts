import { sb } from "../ingest/_env";

async function main() {
  console.log("Deleting synthetic-v1 rows…");
  const { error: delErr, count: delCount } = await sb
    .from("transactions")
    .delete({ count: "exact" })
    .eq("source", "synthetic-v1");
  if (delErr) {
    console.error(delErr);
    process.exit(1);
  }
  console.log(`  deleted ${delCount} synthetic rows`);

  const { data: bySource } = await sb
    .from("transactions")
    .select("source")
    .limit(20000);
  const counts = new Map<string, number>();
  for (const r of bySource ?? []) counts.set(r.source ?? "(null)", (counts.get(r.source ?? "(null)") ?? 0) + 1);
  console.log("\nTransactions by source:");
  for (const [s, n] of counts) console.log(`  ${s.padEnd(20)} ${n}`);

  const { data: byNbhd } = await sb
    .from("transactions")
    .select("neighborhood, price_nis, sqm, price_per_m2");
  if (!byNbhd) return;
  const stats = new Map<string, { n: number; sumPpm: number; sumPrice: number }>();
  for (const r of byNbhd) {
    const k = r.neighborhood ?? "(null)";
    const b = stats.get(k) ?? { n: 0, sumPpm: 0, sumPrice: 0 };
    b.n += 1;
    b.sumPpm += r.price_per_m2 ?? 0;
    b.sumPrice += r.price_nis ?? 0;
    stats.set(k, b);
  }
  console.log("\nPer-neighborhood real-data summary:");
  for (const [n, b] of [...stats.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(
      `  ${n.padEnd(15)} ${String(b.n).padStart(3)} deals · avg ₪${Math.round(b.sumPpm / b.n).toLocaleString()}/m² · avg ₪${Math.round(b.sumPrice / b.n).toLocaleString()} total`,
    );
  }
}

main();

import { sb } from "../ingest/_env";
async function main() {
  const { data } = await sb.from("schools").select("name_he, level, meitzav_score, rating_year").not("meitzav_score", "is", null).order("meitzav_score", { ascending: false }).limit(10);
  console.log(`Top 10 Modi'in schools by Meitzav (real data):`);
  for (const s of data ?? []) console.log(`  ${(s.meitzav_score ?? "?").toString().padStart(3)} (${s.rating_year}) ${s.level?.padEnd(10) ?? ""} ${s.name_he}`);
  const { count } = await sb.from("schools").select("*", { count: "exact", head: true });
  console.log(`\nTotal schools in DB: ${count}`);
}
main();

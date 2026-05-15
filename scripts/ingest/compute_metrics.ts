/**
 * Compute one row in `neighborhood_metrics` per neighborhood.
 *
 * V1 metrics:
 *   avg_price_per_m2   — avg of `transactions.price_per_m2` over last 12 months.
 *   avg_price_yoy_pct  — naive YoY: avg over last 12 months vs prior 12.
 *   avg_listing_price  — avg of `listings.price_nis` (current).
 *   median_rooms       — median of `transactions.rooms` (last 12 months).
 *   school_score       — avg meitzav (rescaled 0–100) of schools <= 1km from polygon centroid.
 *   green_score        — placeholder constant 75 (Phase 2 computes properly).
 *   walk_score         — placeholder constant 70.
 *   quiet_score        — placeholder constant 70.
 */
import { sb } from "./_env";

type NbRow = { id: string };
type Tx = { neighborhood: string; price_per_m2: number | null; rooms: number | null; tx_date: string };
type Listing = { neighborhood: string; price_nis: number };
type School = { meitzav_score: number | null; nb: string };

const ONE_YEAR_AGO = isoDate(-365);
const TWO_YEARS_AGO = isoDate(-730);

function isoDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function main() {
  const { data: nbs, error: e1 } = await sb.from("neighborhoods").select("id");
  if (e1) throw e1;
  if (!nbs || nbs.length === 0) {
    console.warn("No neighborhoods found. Run `npm run ingest:seed` first.");
    return;
  }

  // Bulk-fetch supporting data.
  const { data: txAll } = await sb
    .from("transactions")
    .select("neighborhood, price_per_m2, rooms, tx_date")
    .gte("tx_date", TWO_YEARS_AGO);

  const { data: listingsAll } = await sb.from("listings").select("neighborhood, price_nis");

  // Schools assigned by nearest neighborhood, computed in PostGIS.
  // We do this with an ST_DWithin query per-neighborhood for clarity.
  for (const { id } of nbs as NbRow[]) {
    const recentTx = (txAll ?? [])
      .filter((t): t is Tx => (t as Tx).neighborhood === id && (t as Tx).tx_date >= ONE_YEAR_AGO);
    const priorTx = (txAll ?? [])
      .filter((t): t is Tx => (t as Tx).neighborhood === id && (t as Tx).tx_date < ONE_YEAR_AGO && (t as Tx).tx_date >= TWO_YEARS_AGO);

    const ppmRecent = recentTx.map((t) => t.price_per_m2 ?? 0).filter((n) => n > 0);
    const ppmPrior = priorTx.map((t) => t.price_per_m2 ?? 0).filter((n) => n > 0);

    const avgPpmRecent = mean(ppmRecent);
    const avgPpmPrior = mean(ppmPrior);
    const yoyPct =
      avgPpmRecent != null && avgPpmPrior != null && avgPpmPrior > 0
        ? ((avgPpmRecent - avgPpmPrior) / avgPpmPrior) * 100
        : null;

    const listings = (listingsAll ?? []).filter((l): l is Listing => (l as Listing).neighborhood === id);
    const avgListing = mean(listings.map((l) => Number(l.price_nis)));

    const medRooms = median(recentTx.map((t) => Number(t.rooms ?? 0)).filter((r) => r > 0));

    // Schools within 1km of the neighborhood centroid (PostGIS RPC fallback below).
    const { data: nearbySchools } = await sb.rpc("schools_within_meters", {
      neighborhood_id: id,
      meters: 1000,
    });

    const schoolScores = (nearbySchools as { meitzav_score: number | null }[] | null ?? [])
      .map((s) => s.meitzav_score)
      .filter((n): n is number => n != null);
    const schoolScore = schoolScores.length > 0 ? Math.round(mean(schoolScores)! * 10) : 75;

    const row = {
      neighborhood: id,
      avg_price_per_m2: avgPpmRecent != null ? Math.round(avgPpmRecent) : null,
      avg_price_yoy_pct: yoyPct,
      avg_listing_price: avgListing != null ? Math.round(avgListing) : null,
      median_rooms: medRooms,
      walk_score: 70,
      green_score: 75,
      school_score: schoolScore,
      quiet_score: 70,
      computed_at: new Date().toISOString(),
    };

    const { error } = await sb.from("neighborhood_metrics").upsert(row);
    if (error) {
      console.error(`✗ ${id}:`, error.message);
      process.exitCode = 1;
    } else {
      console.log(`✓ ${id} — ppm=${row.avg_price_per_m2 ?? "—"} yoy=${row.avg_price_yoy_pct?.toFixed(1) ?? "—"}% schools=${row.school_score}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Compute one row in `neighborhood_metrics` per neighborhood.
 *
 * HONESTY RULE (2026-07-23): price metrics are published only when backed by
 * *real, recent, sufficient* Govmap transactions. If a neighborhood has fewer
 * than MIN_SALES real sales in the last WINDOW_MONTHS, its price fields are set
 * to NULL — the UI then says "אין נתונים עדכניים" instead of showing a
 * fabricated or years-stale number. Prior runs derived prices from synthetic
 * listings; this replaces that.
 *
 * V1 metrics:
 *   avg_price_per_m2   — mean of real `transactions.price_per_m2`, last WINDOW_MONTHS, else null.
 *   avg_listing_price  — MEDIAN of real `transactions.price_nis` (actual sale price), same window.
 *                        (Column name is legacy; the card labels it "חציון", so a median is correct.)
 *   avg_price_yoy_pct  — last-12mo mean vs prior-12mo mean, only if both have >= MIN_SALES sales.
 *   median_rooms       — median of `transactions.rooms` in the window.
 *   school_score       — avg meitzav of schools <= 1km (pending schools-panel revival; falls back to null).
 *   green_score        — placeholder constant 75 (still fake — tracked separately).
 *   walk_score         — placeholder constant 70 (still fake).
 *   quiet_score        — placeholder constant 70 (still fake).
 */
import { sb } from "./_env";

type NbRow = { id: string };
type Tx = { neighborhood: string; price_per_m2: number | null; price_nis: number | null; rooms: number | null; tx_date: string };

/** Only publish a price if backed by this many real sales inside the window. */
const MIN_SALES = 4;
/** How far back a sale can be and still count as "recent". 48mo balances
 *  coverage (6/14 neighborhoods) against currency — a wider window would add
 *  coverage but drag prices toward pre-run-up years. */
const WINDOW_MONTHS = 48;

const WINDOW_START = isoMonthsAgo(WINDOW_MONTHS);
const ONE_YEAR_AGO = isoMonthsAgo(12);
const TWO_YEARS_AGO = isoMonthsAgo(24);

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
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

  // Bulk-fetch real transactions inside the recency window.
  const { data: txAll } = await sb
    .from("transactions")
    .select("neighborhood, price_per_m2, price_nis, rooms, tx_date")
    .gte("tx_date", WINDOW_START);

  for (const { id } of nbs as NbRow[]) {
    const windowTx = (txAll ?? []).filter((t): t is Tx => (t as Tx).neighborhood === id);
    const enough = windowTx.length >= MIN_SALES;

    // Prices — published ONLY when backed by >= MIN_SALES real recent sales.
    let avgPpm: number | null = null;
    let medSale: number | null = null;
    let medRooms: number | null = null;
    if (enough) {
      avgPpm = round(mean(windowTx.map((t) => t.price_per_m2 ?? 0).filter((n) => n > 0)));
      medSale = round(median(windowTx.map((t) => Number(t.price_nis ?? 0)).filter((n) => n > 0)));
      medRooms = median(windowTx.map((t) => Number(t.rooms ?? 0)).filter((r) => r > 0));
    }

    // YoY — only when BOTH the last 12mo and the prior 12mo clear the bar, so
    // we never report a "trend" off one or two sales.
    // YoY needs a fatter sample than a point price — a 3-4 sale "trend" is
    // noise, and a wrong ±30% badge is worse than no badge.
    const MIN_SALES_YOY = 8;
    const recentTx = windowTx.filter((t) => t.tx_date >= ONE_YEAR_AGO);
    const priorTx = windowTx.filter((t) => t.tx_date < ONE_YEAR_AGO && t.tx_date >= TWO_YEARS_AGO);
    let yoyPct: number | null = null;
    if (recentTx.length >= MIN_SALES_YOY && priorTx.length >= MIN_SALES_YOY) {
      const r = mean(recentTx.map((t) => t.price_per_m2 ?? 0).filter((n) => n > 0));
      const p = mean(priorTx.map((t) => t.price_per_m2 ?? 0).filter((n) => n > 0));
      if (r != null && p != null && p > 0) yoyPct = ((r - p) / p) * 100;
    }

    // Schools within 1km. The RPC depends on schools_geojson, which is dead
    // until migration 0003_school_metadata.sql is applied — until then this
    // returns nothing and we honestly store null (no fabricated 75).
    const { data: nearbySchools } = await sb.rpc("schools_within_meters", {
      neighborhood_id: id,
      meters: 1000,
    });
    const schoolScores = (nearbySchools as { meitzav_score: number | null }[] | null ?? [])
      .map((s) => s.meitzav_score)
      .filter((n): n is number => n != null);
    // Meitzav is Israel's standardized scale (~500 mean, ~100 SD), NOT 0-100.
    // Map the neighborhood's avg to a national percentile so "72" means "better
    // than ~72% of schools". Real-derived (system inference over real scores).
    // Coverage caveat: ~2/3 of schools currently share a bad-geocode fallback
    // point, so only correctly-located schools count until the geocode is fixed
    // alongside migration 0003_school_metadata.sql.
    const avgMeitzav = mean(schoolScores);
    const schoolScore = avgMeitzav != null ? Math.round(100 * normCdf((avgMeitzav - 500) / 100)) : null;

    const row = {
      neighborhood: id,
      avg_price_per_m2: avgPpm,
      avg_price_yoy_pct: yoyPct,
      avg_listing_price: medSale,
      median_rooms: medRooms,
      walk_score: 70, // still placeholder — tracked separately
      green_score: 75, // still placeholder — tracked separately
      school_score: schoolScore,
      quiet_score: 70, // still placeholder — tracked separately
      computed_at: new Date().toISOString(),
    };

    const { error } = await sb.from("neighborhood_metrics").upsert(row);
    if (error) {
      console.error(`✗ ${id}:`, error.message);
      process.exitCode = 1;
    } else {
      const tag = enough
        ? `₪${avgPpm}/m² · median ₪${((medSale ?? 0) / 1e6).toFixed(2)}M · ${windowTx.length} sales · yoy=${yoyPct != null ? yoyPct.toFixed(1) + "%" : "—"}`
        : `NO RECENT DATA (${windowTx.length} sales in ${WINDOW_MONTHS}mo, need ${MIN_SALES})`;
      console.log(`${enough ? "✓" : "○"} ${id.padEnd(12)} ${tag}`);
    }
  }
}

function round(n: number | null): number | null {
  return n == null ? null : Math.round(n);
}

/** Standard-normal CDF (Abramowitz–Stegun 26.2.17). Maps a z-score to 0–1. */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

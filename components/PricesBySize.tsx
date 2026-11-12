"use client";

import { ROOM_KEYS, ROOM_LABEL, marketPrice, priceLabel, type Deal, type Market } from "@/lib/market";

type Props = {
  /** The neighborhood's own figures; null when the source has none for it. */
  market: Market | null;
  /** City-wide figures, shown next to each number for context. */
  cityMarket: Market | null;
  cityName: string;
  /** The source's own "updated" stamp (dd-mm-yyyy). */
  version?: string | null;
  /** The deal type the family is looking at — its column is emphasised. */
  deal: Deal;
};

/**
 * Rent and sale price for a 3 / 4 / 5-room home in this neighborhood, each
 * with the city figure beside it. When the neighborhood has no figures of its
 * own, the city's are shown — and labelled as the city's.
 */
export function PricesBySize({ market, cityMarket, cityName, version, deal }: Props) {
  const own = market && ROOM_KEYS.some((k) => marketPrice(market, "rent", k) != null || marketPrice(market, "buy", k) != null);
  const shown = own ? market : cityMarket;
  if (!shown) return null;
  const keys = ROOM_KEYS.filter((k) => marketPrice(shown, "rent", k) != null || marketPrice(shown, "buy", k) != null);
  if (keys.length === 0) return null;

  const cell = (d: Deal, k: (typeof ROOM_KEYS)[number]) => {
    const v = marketPrice(shown, d, k);
    const c = own ? marketPrice(cityMarket, d, k) : null;
    return (
      <td className={d === deal ? "is-focus" : undefined}>
        {v != null ? <strong>{priceLabel(v, d)}</strong> : <span className="mm-sizes-none">אין נתון</span>}
        {v != null && c != null && <small>בעיר {priceLabel(c, d)}</small>}
      </td>
    );
  };

  const stamp = version?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return (
    <div>
      {!own && (
        <p className="mm-sizes-note">
          אין נתון נפרד לשכונה הזו. המספרים כאן הם הממוצע של {cityName} כולה.
        </p>
      )}
      <table className="mm-sizes">
        <thead>
          <tr>
            <th scope="col">גודל</th>
            <th scope="col" className={deal === "rent" ? "is-focus" : undefined}>
              שכירות לחודש
            </th>
            <th scope="col" className={deal === "buy" ? "is-focus" : undefined}>
              מחיר קנייה
            </th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <th scope="row">{ROOM_LABEL[k]}</th>
              {cell("rent", k)}
              {cell("buy", k)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mm-sizes-foot">
        {own && shown.yieldPct != null && shown.yieldPct > 0 && <>תשואת שכירות שנתית: כ-{shown.yieldPct.toFixed(1)}% · </>}
        ממוצע 12 החודשים האחרונים, לפי אתר הנדל״ן הממשלתי
        {stamp ? ` (עודכן ${stamp[2]}/${stamp[3]})` : ""}.
      </p>
    </div>
  );
}

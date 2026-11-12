"use client";

import {
  DEAL_LABEL,
  MAX_OPTIONS,
  ROOM_KEYS,
  ROOM_LABEL,
  priceLabel,
  type Deal,
  type PriceFilter,
} from "@/lib/market";

type Props = {
  filter: PriceFilter;
  onChange: (next: PriceFilter) => void;
  /** Which deal types this city has any figures for. */
  available: Record<Deal, boolean>;
  /** Neighborhoods passing the filter / all neighborhoods. */
  shown: number;
  total: number;
};

/**
 * Buy / rent switch + apartment size + price ceiling. Shared by the desktop
 * list rail and the phone "all neighborhoods" sheet; the map dims whatever the
 * filter rules out.
 */
export function PriceFilterBar({ filter, onChange, available, shown, total }: Props) {
  const deals = (["buy", "rent"] as Deal[]).filter((d) => available[d]);
  if (deals.length === 0) return null;
  const maxId = `mm-price-max-${filter.deal}`;

  return (
    <div className="mm-pricefilter" role="group" aria-label="סינון לפי מחיר">
      <div className="mm-pricefilter-row">
        {deals.length > 1 && (
          <div className="mm-seg" role="radiogroup" aria-label="קנייה או שכירות">
            {deals.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={filter.deal === d}
                className={filter.deal === d ? "is-on" : ""}
                onClick={() => filter.deal !== d && onChange({ deal: d, rooms: filter.rooms, max: null })}
              >
                {DEAL_LABEL[d]}
              </button>
            ))}
          </div>
        )}
        <div className="mm-pricefilter-rooms" role="radiogroup" aria-label="גודל דירה">
          {ROOM_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filter.rooms === k}
              className={`mm-chip ${filter.rooms === k ? "mm-chip-on" : ""}`}
              style={{ height: 26, fontSize: 11, padding: "0 8px" }}
              onClick={() => onChange({ ...filter, rooms: k })}
            >
              {k === "all" ? "הכול" : ROOM_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="mm-pricefilter-row">
        <label htmlFor={maxId} className="mm-pricefilter-label">
          {filter.deal === "rent" ? "שכר דירה עד" : "מחיר עד"}
        </label>
        <select
          id={maxId}
          className="mm-pricefilter-select"
          value={filter.max ?? ""}
          onChange={(e) => onChange({ ...filter, max: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">בלי הגבלה</option>
          {MAX_OPTIONS[filter.deal].map((v) => (
            <option key={v} value={v}>
              {priceLabel(v, filter.deal)}
              {filter.deal === "rent" ? " לחודש" : ""}
            </option>
          ))}
        </select>
        {filter.max != null && (
          <span className="mm-pricefilter-count" aria-live="polite">
            {shown} מתוך {total}
          </span>
        )}
      </div>
    </div>
  );
}

/** "שכירות · 4 חד׳" — what a row's price refers to. */
export function priceContext(filter: Pick<PriceFilter, "deal" | "rooms">): string {
  const size = filter.rooms === "all" ? "" : ` ${ROOM_LABEL[filter.rooms]}`;
  return filter.deal === "rent" ? `שכירות${size}` : filter.rooms === "all" ? "מחיר דירה" : `קנייה${size}`;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { priceLabel, type Deal, type PriceFilter } from "@/lib/market";
import { PriceFilterBar, priceContext } from "./PriceFilterBar";
import { MatchBadge } from "./MatchBadge";
import { useFavorites } from "@/lib/useFavorites";

/**
 * Persistent right-side rail listing every neighborhood. Replaces both the
 * bottom carousel + the modal "all neighborhoods" sheet — users see the full
 * sortable list at all times.
 *
 * Card click selects the neighborhood on the map (highlights polygon, flies
 * the map, sets the orange selected border). Listings + AI for the selected
 * neighborhood live in a separate detail sheet, opened by the
 * "פתח פרטים" button on the selected card.
 */
export type NeighborhoodListItem = {
  id: string;
  he: string;
  family: string | null;
  summary: string | null;
  matchScore: number;
  avgListing: number;
  greenScore: number;
  /** Price under the active filter (deal type + apartment size); null = no figure. */
  price: number | null;
  /** Passes the active price ceiling. */
  fits: boolean;
};

type Sort = "match" | "price-asc" | "price-desc" | "green";

const SORT_LABELS: Record<Sort, string> = {
  match: "התאמה",
  "price-asc": "מחיר ↑",
  "price-desc": "מחיר ↓",
  green: "GreenScore",
};

type Props = {
  items: NeighborhoodListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  cityName?: string;
  priceFilter: PriceFilter;
  onPriceFilter: (next: PriceFilter) => void;
  /** Which deal types this city has figures for. */
  priceAvailable: Record<Deal, boolean>;
  /** Neighborhood hovered on the map — its row is tinted. */
  hoverId?: string | null;
  /** Hovering / focusing a row outlines that neighborhood on the map. */
  onHover?: (id: string | null) => void;
  /** Ids currently in the comparison set. */
  compareIds?: Set<string>;
  onToggleCompare?: (id: string) => void;
};

export function NeighborhoodListRail({
  items,
  selectedId,
  onSelect,
  cityName = "מודיעין-מכבים-רעות",
  hoverId = null,
  onHover,
  compareIds,
  onToggleCompare,
  priceFilter,
  onPriceFilter,
  priceAvailable,
}: Props) {
  const [sort, setSort] = useState<Sort>("match");
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // A city with no price data at all doesn't offer price sorting or repeat
  // "no price" on every row — one note in the header says it once.
  const hasPrices = priceAvailable.buy || priceAvailable.rent;
  const sorts = (Object.keys(SORT_LABELS) as Sort[]).filter((s) => hasPrices || !s.startsWith("price"));

  // The price ceiling hides what doesn't fit; the selected neighborhood stays
  // listed so the row for what's open on the map never vanishes.
  const visible = useMemo(() => items.filter((n) => n.fits || n.id === selectedId), [items, selectedId]);
  const hiddenCount = items.length - items.filter((n) => n.fits).length;

  const sorted = useMemo(() => {
    const arr = [...visible];
    // Neighborhoods with no figure go last in either price order.
    const byPrice = (dir: 1 | -1) => (a: (typeof arr)[number], b: (typeof arr)[number]) =>
      a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 : dir * (a.price - b.price);
    if (sort === "match") arr.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === "price-asc") arr.sort(byPrice(1));
    else if (sort === "price-desc") arr.sort(byPrice(-1));
    else if (sort === "green") arr.sort((a, b) => b.greenScore - a.greenScore);
    return arr;
  }, [visible, sort]);

  // When the selection changes externally (map click, search), scroll the
  // matching card into view inside the rail.
  useEffect(() => {
    if (!selectedId) return;
    const container = scrollRef.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>(`[data-nb-id="${selectedId}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  return (
    <aside
      style={{
        background: "#fff",
        borderInlineStart: "1px solid var(--stroke-weak)",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
      aria-label="כל השכונות"
    >
      <header
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid var(--stroke-weak)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>כל השכונות</h3>
          <div style={{ fontSize: 11, color: "var(--grey-500)", marginTop: 2 }}>
            {items.length} שכונות ב{cityName}
            {!hasPrices && " · נתוני מחירים בקרוב"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {sorts.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
              className={`mm-chip ${sort === s ? "mm-chip-on" : ""}`}
              style={{ height: 26, fontSize: 11, padding: "0 8px" }}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
        <PriceFilterBar
          filter={priceFilter}
          onChange={onPriceFilter}
          available={priceAvailable}
          shown={items.length - hiddenCount}
          total={items.length}
        />
      </header>

      <div
        ref={scrollRef}
        className="mm-scroll"
        style={{
          overflow: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {sorted.map((n) => {
          const isSelected = n.id === selectedId;
          const isFav = hasNeighborhood(n.id);
          const inCompare = compareIds?.has(n.id) ?? false;
          return (
            <div
              key={n.id}
              data-nb-id={n.id}
              className="mm-card mm-card-hover"
              onMouseEnter={() => onHover?.(n.id)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(n.id)}
              onBlur={() => onHover?.(null)}
              style={{
                padding: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                background: hoverId === n.id && !isSelected ? "var(--hn-surface-2)" : undefined,
                borderColor: isSelected ? "var(--pumpkin-orange)" : undefined,
                boxShadow: isSelected ? "0 0 0 2px var(--pumpkin-orange)" : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              role="button"
              aria-pressed={isSelected}
              tabIndex={0}
              onClick={() => onSelect(n.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return; // keys on the inner buttons are theirs
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.id);
                } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  // Walk the list with the arrow keys (focus outlines the
                  // neighborhood on the map); Enter selects.
                  e.preventDefault();
                  const row = e.currentTarget;
                  const next = (e.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling) as HTMLElement | null;
                  next?.focus();
                  next?.scrollIntoView({ block: "nearest" });
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNeighborhood(n.id);
                  }}
                  aria-label={isFav ? `הסר את ${n.he} מהשמורים` : `שמור את ${n.he}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: 0,
                    background: isFav ? "rgba(255,107,0,0.10)" : "var(--grey-15)",
                    color: isFav ? "var(--pumpkin-orange)" : "var(--grey-500)",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                  }}
                >
                  <MMIcon name={isFav ? "heart-fill" : "heart"} size={10} color="currentColor" />
                </button>
                {onToggleCompare && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompare(n.id);
                    }}
                    aria-label={inCompare ? `הסר את ${n.he} מההשוואה` : `הוסף את ${n.he} להשוואה`}
                    aria-pressed={inCompare}
                    title={inCompare ? "בהשוואה" : "הוסף להשוואה"}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: 0,
                      background: inCompare ? "var(--grey-900)" : "var(--grey-15)",
                      color: inCompare ? "#fff" : "var(--grey-500)",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flex: "none",
                    }}
                  >
                    <MMIcon name="compare" size={10} color="currentColor" />
                  </button>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "var(--grey-900)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {n.he}
                  </div>
                  {n.family && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--grey-500)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.family}
                    </div>
                  )}
                </div>
                <MatchBadge score={n.matchScore} />
              </div>
              {n.summary && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "var(--grey-700)",
                    lineHeight: "16px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {n.summary}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 11,
                  fontFamily: "var(--font-inter, Inter)",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--grey-700)",
                  alignItems: "center",
                }}
              >
                {hasPrices && (
                  <>
                    <span style={n.fits ? undefined : { color: "var(--grey-500)" }}>
                      {n.price != null
                        ? `${priceContext(priceFilter)} ${priceLabel(n.price, priceFilter.deal)}`
                        : `${priceContext(priceFilter)}: אין נתון`}
                    </span>
                    <span>·</span>
                  </>
                )}
                <span style={{ color: "var(--green-positive)" }}>GS {n.greenScore}</span>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <p className="mm-pricefilter-note">
            {hiddenCount} שכונות לא מוצגות: מעל התקציב שבחרתם, או שאין עליהן נתון לגודל הזה.
          </p>
        )}
      </div>
    </aside>
  );
}

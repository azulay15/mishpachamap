"use client";

import { useEffect, useMemo, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { priceLabel, type Deal, type PriceFilter } from "@/lib/market";
import { PriceFilterBar, priceContext } from "./PriceFilterBar";
import { MatchBadge } from "./MatchBadge";
import { useFavorites } from "@/lib/useFavorites";
import { useFocusTrap } from "@/lib/useFocusTrap";

export type AllNeighborhoodsItem = {
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

type Props = {
  items: AllNeighborhoodsItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  cityName?: string;
  priceFilter: PriceFilter;
  onPriceFilter: (next: PriceFilter) => void;
  /** Which deal types this city has figures for. */
  priceAvailable: Record<Deal, boolean>;
};

type Sort = "match" | "price-asc" | "price-desc" | "green";

const SORT_LABELS: Record<Sort, string> = {
  match: "התאמה",
  "price-asc": "מחיר ↑",
  "price-desc": "מחיר ↓",
  green: "GreenScore",
};

export function AllNeighborhoodsSheet({ items, selectedId, onSelect, onClose, cityName = "מודיעין-מכבים-רעות", priceFilter, onPriceFilter, priceAvailable }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [sort, setSort] = useState<Sort>("match");
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return (
    <div
      onClick={onClose}
      className="mm-sheet-tabbed"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 55,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="כל השכונות"
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        className="mm-scroll mm-modal-content"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(960px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px 14px",
            borderBottom: "1px solid var(--stroke-weak)",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <div style={{ flex: "1 1 160px", minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>כל השכונות</h3>
            <div style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 2 }}>
              {items.length} שכונות ב{cityName}
            {!hasPrices && " · נתוני מחירים בקרוב"}
            </div>
          </div>
          <div className="mm-sheet-sorts" style={{ display: "flex", gap: 6 }}>
            {sorts.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                aria-pressed={sort === s}
                className={`mm-chip ${sort === s ? "mm-chip-on" : ""}`}
                style={{ height: 28, fontSize: 11, padding: "0 10px" }}
              >
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mm-btn mm-btn-ghost mm-btn-sm"
            aria-label="סגור"
            style={{ padding: 6, order: 1 }}
          >
            <MMIcon name="x" size={16} />
          </button>
          <div style={{ flex: "1 1 100%", order: 3 }}>
            <PriceFilterBar
              filter={priceFilter}
              onChange={onPriceFilter}
              available={priceAvailable}
              shown={items.length - hiddenCount}
              total={items.length}
            />
          </div>
        </header>

        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {sorted.map((n) => {
            const isSelected = n.id === selectedId;
            const isFav = hasNeighborhood(n.id);
            return (
              // A div, not a <button>: the row contains its own save button,
              // and a button inside a button is invalid HTML.
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(n.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.id);
                    onClose();
                  }
                }}
                aria-pressed={isSelected}
                className="mm-card mm-card-hover"
                style={{
                  padding: 12,
                  textAlign: "start",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderColor: isSelected ? "var(--pumpkin-orange)" : undefined,
                  boxShadow: isSelected ? "0 0 0 2px var(--pumpkin-orange)" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNeighborhood(n.id);
                    }}
                    aria-label={isFav ? `הסר את ${n.he} מהשמורים` : `שמור את ${n.he}`}
                    style={{
                      width: 24,
                      height: 24,
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
                    <MMIcon name={isFav ? "heart-fill" : "heart"} size={11} color="currentColor" />
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
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
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    fontSize: 11,
                    fontFamily: "var(--font-inter, Inter)",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--grey-700)",
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
      </div>
    </div>
  );
}

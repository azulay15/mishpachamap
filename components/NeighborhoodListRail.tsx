"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { NISshort } from "@/lib/format";
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
};

export function NeighborhoodListRail({ items, selectedId, onSelect }: Props) {
  const [sort, setSort] = useState<Sort>("match");
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "match") arr.sort((a, b) => b.matchScore - a.matchScore);
    else if (sort === "price-asc") arr.sort((a, b) => a.avgListing - b.avgListing);
    else if (sort === "price-desc") arr.sort((a, b) => b.avgListing - a.avgListing);
    else if (sort === "green") arr.sort((a, b) => b.greenScore - a.greenScore);
    return arr;
  }, [items, sort]);

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
            {items.length} שכונות במודיעין-מכבים-רעות
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
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
          return (
            <div
              key={n.id}
              data-nb-id={n.id}
              className="mm-card mm-card-hover"
              style={{
                padding: 10,
                cursor: "pointer",
                fontFamily: "inherit",
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
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.id);
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
                <span>חציון {NISshort(n.avgListing)}</span>
                <span>·</span>
                <span style={{ color: "var(--green-positive)" }}>GS {n.greenScore}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

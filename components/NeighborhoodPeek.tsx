"use client";

import { useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { MatchBadge } from "./MatchBadge";
import { useFavorites } from "@/lib/useFavorites";
import type { MatchBreakdownRow } from "@/lib/match";

type Props = {
  id: string;
  he: string;
  family: string | null;
  matchScore: number;
  greenScore: number;
  /** e.g. "שכירות 4 חד׳ ₪7,800" — the price under the active filter. */
  priceText?: string | null;
  /** Persona-aware breakdown; the three strongest rows are shown. */
  breakdown: MatchBreakdownRow[];
  onExpand: () => void;
  onClose: () => void;
  onExplainMatch: () => void;
};

/**
 * Short bottom sheet shown when a neighborhood is tapped on the map (phones).
 * Non-modal — the map stays usable behind it. Drag it up (or tap "כל
 * הפרטים") for the full details drawer; drag it down to dismiss.
 */
export function NeighborhoodPeek({
  id,
  he,
  family,
  matchScore,
  greenScore,
  priceText,
  breakdown,
  onExpand,
  onClose,
  onExplainMatch,
}: Props) {
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();
  const isFav = hasNeighborhood(id);
  const [dragY, setDragY] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Strongest fits first: the share of each row's weight this neighborhood earns.
  const top = [...breakdown]
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.hit / b.weight - a.hit / a.weight)
    .slice(0, 3);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startRef.current = e.clientY;
    setDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startRef.current == null) return;
    setDragY(e.clientY - startRef.current);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startRef.current == null) return;
    const dy = e.clientY - startRef.current;
    startRef.current = null;
    setDragY(null);
    // A tap on the handle (no real movement) expands, like a drag up.
    if (dy < -30 || Math.abs(dy) < 4) onExpand();
    else if (dy > 50) onClose();
  };

  return (
    <section
      className="mm-peek"
      aria-label={`שכונת ${he}`}
      style={{
        transform: dragY != null ? `translateY(${Math.max(-24, dragY)}px)` : undefined,
        transition: dragY != null ? "none" : undefined,
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label="גררו למעלה לכל הפרטים"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onExpand();
          }
        }}
        style={{ touchAction: "none", cursor: "grab", padding: "8px 0 6px", display: "flex", justifyContent: "center" }}
      >
        <div className="mm-drawer-handle" style={{ margin: 0 }} />
      </div>

      <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, lineHeight: "24px" }}>{he}</h3>
              <MatchBadge score={matchScore} onClick={onExplainMatch} />
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--grey-500)" }}>
              {[family, priceText, `GreenScore ${greenScore}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleNeighborhood(id)}
            aria-label={isFav ? `הסר את ${he} מהשמורים` : `שמור את ${he}`}
            aria-pressed={isFav}
            className="mm-peek-icon"
            style={{ color: isFav ? "var(--hn-accent)" : "var(--grey-700)" }}
          >
            <MMIcon name={isFav ? "heart-fill" : "heart"} size={17} color="currentColor" />
          </button>
          <button type="button" onClick={onClose} aria-label="סגור" className="mm-peek-icon">
            <MMIcon name="x" size={17} />
          </button>
        </div>

        {top.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {top.map((r) => {
              const ratio = r.weight > 0 ? r.hit / r.weight : 0;
              return (
                <li key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 84px 34px", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: "var(--grey-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.label}
                  </span>
                  <span className="mm-score-bar" aria-hidden>
                    <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>
                  <span style={{ fontFamily: "var(--font-inter, Inter)", fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 12, color: "var(--grey-700)", textAlign: "end" }}>
                    {Math.round(ratio * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" onClick={onExpand} className="mm-btn mm-btn-accent" style={{ height: 42, fontSize: 14 }}>
          כל הפרטים על השכונה
          <MMIcon name="chevron-left" size={15} color="#fff" />
        </button>
      </div>
    </section>
  );
}

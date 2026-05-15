"use client";

import { useEffect } from "react";
import { breakdownForGreenScore, colorFor } from "@/lib/greenscore";
import { ScoreChip } from "./ScoreChip";
import { MMIcon } from "@/lib/icons";

type Props = {
  /** Neighborhood Hebrew name to show in the header. */
  neighborhoodHe: string;
  /** Overall GreenScore 0-100. */
  score: number;
  onClose: () => void;
};

export function GreenScoreSheet({ neighborhoodHe, score, onClose }: Props) {
  const components = breakdownForGreenScore(score);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`פירוט GreenScore עבור ${neighborhoodHe}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(560px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
        }}
        className="mm-scroll"
      >
        {/* Header */}
        <header
          style={{
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 14,
            borderBottom: "1px solid var(--stroke-weak)",
          }}
        >
          <ScoreChip value={score} color="var(--green-positive)" size="lg" />
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              GreenScore · {neighborhoodHe}
            </h3>
            <div style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 2 }}>
              ציון מסכם של 7 רכיבי איכות סביבה
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mm-btn mm-btn-ghost mm-btn-sm"
            aria-label="סגור"
            style={{ padding: 6 }}
          >
            <MMIcon name="x" size={16} />
          </button>
        </header>

        {/* Component list */}
        <div style={{ padding: "8px 20px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {components.map((c) => (
            <ComponentRow key={c.label} {...c} />
          ))}
        </div>

        {/* Footer / methodology note */}
        <footer
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--stroke-weak)",
            fontSize: 11,
            color: "var(--grey-500)",
            lineHeight: "16px",
          }}
        >
          <strong style={{ color: "var(--grey-700)" }}>שיטת חישוב (V1):</strong>{" "}
          ערכי הרכיבים מבוססים על קווי בסיס של מודיעין, מותאמים לציון הכללי של השכונה.
          בגרסת הפריצה (V2) כל רכיב יחושב ממקור פתוח: NDVI לוויינים לעצים, OSM לפארקים,
          data.gov.il לאיכות אוויר ורעש, ומשרד האנרגיה לסולארי.
        </footer>
      </div>
    </div>
  );
}

function ComponentRow({ label, weight, value }: { label: string; weight: number; value: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 32px 64px",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--grey-15)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grey-900)" }}>{label}</div>
        <div className="mm-score-bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${value}%`, background: colorFor(value) }} />
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--grey-500)",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {weight}%
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          fontFamily: "var(--font-inter, Inter)",
          fontVariantNumeric: "tabular-nums",
          color: colorFor(value),
          textAlign: "end",
        }}
      >
        {value}
      </div>
    </div>
  );
}

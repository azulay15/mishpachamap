"use client";

import { useEffect } from "react";
import { breakdownFor, scoreColor, type NeighborhoodFacts } from "@/lib/match";
import type { Persona } from "@/lib/persona";
import { MMIcon } from "@/lib/icons";

type Props = {
  neighborhoodHe: string;
  facts: NeighborhoodFacts;
  persona: Persona;
  onClose: () => void;
};

export function MatchBreakdownSheet({ neighborhoodHe, facts, persona, onClose }: Props) {
  const rows = breakdownFor(facts, persona);
  const total = Math.min(99, rows.reduce((s, r) => s + r.hit, 0));
  const headerColor = scoreColor(total);

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
      aria-label={`פירוט התאמה עבור ${neighborhoodHe}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-scroll mm-modal-content"
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
      >
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
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: headerColor,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontFamily: "var(--font-inter, Inter)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ fontSize: 22 }}>{total}</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              התאמה · {neighborhoodHe}
            </h3>
            <div style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 2 }}>
              ציון מבוסס פרופיל: {persona.name} · {persona.kids.length} ילדים
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

        <div style={{ padding: "8px 20px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => (
            <BreakdownRow key={r.label} {...r} />
          ))}
        </div>

        <footer
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--stroke-weak)",
            fontSize: 11,
            color: "var(--grey-500)",
            lineHeight: "16px",
          }}
        >
          <strong style={{ color: "var(--grey-700)" }}>איך מחושב הציון:</strong>{" "}
          תקציב תורם תמיד 25%. כל תכונת "חובה" שבחרתם תורמת 15%, כל תכונת "כדאי" תורמת 5%.
          המשקלים מנורמלים ל-100 לפי מה שבחרתם. שנו את התכונות ב-<a href="/onboarding" style={{ color: "var(--text-link)" }}>הגדרת הפרופיל</a>.
        </footer>
      </div>
    </div>
  );
}

function BreakdownRow({ label, weight, hit }: { label: string; weight: number; hit: number }) {
  const ratio = weight > 0 ? hit / weight : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 48px 64px",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--grey-15)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grey-900)" }}>{label}</div>
        <div className="mm-score-bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${ratio * 100}%`, background: scoreColor(Math.round(ratio * 100)) }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--grey-500)", fontWeight: 600, textAlign: "center" }}>
        משקל {weight}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          fontFamily: "var(--font-inter, Inter)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--grey-900)",
          textAlign: "end",
        }}
      >
        {hit}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { MMIcon } from "@/lib/icons";
import { NIS, NISshort, pct } from "@/lib/format";
import { breakdownFor, totalScore, type NeighborhoodFacts } from "@/lib/match";
import { scoreColor } from "@/lib/match";
import type { Persona } from "@/lib/persona";

export type CompareItem = {
  id: string;
  he: string;
  family: string | null;
  avgListing: number;
  avgPrice: number;
  avgPriceDelta: number;
  greenScore: number;
  schoolScore: number;
  facts: NeighborhoodFacts;
};

type Props = {
  items: CompareItem[];
  persona: Persona;
  onClose: () => void;
  onRemove: (id: string) => void;
};

export function CompareSheet({ items, persona, onClose, onRemove }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const enriched = useMemo(
    () =>
      items.map((n) => {
        const rows = breakdownFor(n.facts, persona);
        const matchScore = Math.min(99, totalScore(rows));
        return { ...n, matchScore };
      }),
    [items, persona],
  );

  // Compute the "best" value for each comparison row so we can highlight it.
  const rows: ComparisonRow<typeof enriched[number]>[] = [
    {
      label: "ציון התאמה",
      get: (n) => n.matchScore,
      format: (v) => `${v}/100`,
      higherIsBetter: true,
    },
    {
      label: "חציון מחיר",
      get: (n) => n.avgListing,
      format: (v) => (v > 0 ? NISshort(v) : "—"),
      higherIsBetter: null, // depends on persona — don't highlight
    },
    {
      label: 'מחיר/מ"ר',
      get: (n) => n.avgPrice,
      format: (v) => (v > 0 ? NIS(v) : "—"),
      higherIsBetter: null,
    },
    {
      label: "מגמת מחירים (YoY)",
      get: (n) => n.avgPriceDelta,
      format: (v) => pct(v),
      higherIsBetter: null,
    },
    {
      label: "GreenScore",
      get: (n) => n.greenScore,
      format: (v) => String(v),
      higherIsBetter: true,
    },
    {
      label: "בתי ספר (ציון)",
      get: (n) => n.schoolScore,
      format: (v) => String(v),
      higherIsBetter: true,
    },
    {
      label: "מרחק לבית ספר",
      get: (n) => n.facts.schoolWalkMeters ?? Infinity,
      format: (v) => (v === Infinity ? "—" : `${Math.round(v)}m`),
      higherIsBetter: false,
    },
    {
      label: "מרחק לפארק",
      get: (n) => n.facts.parkMeters ?? Infinity,
      format: (v) => (v === Infinity ? "—" : `${Math.round(v)}m`),
      higherIsBetter: false,
    },
    {
      label: "מרחק למרכול",
      get: (n) => n.facts.shopMeters ?? Infinity,
      format: (v) => (v === Infinity ? "—" : `${Math.round(v)}m`),
      higherIsBetter: false,
    },
    {
      label: "מרחק לתחבורה",
      get: (n) => n.facts.transitMeters ?? Infinity,
      format: (v) => (v === Infinity ? "—" : `${Math.round(v)}m`),
      higherIsBetter: false,
    },
    {
      label: "ללא גלוטן (טווח)",
      get: (n) => n.facts.celiacDistance ?? Infinity,
      format: (v) => (v === Infinity ? "—" : `${Math.round(v)}m`),
      higherIsBetter: false,
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 65,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="השוואת שכונות"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-scroll mm-modal-content"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(900px, 100%)",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            borderBottom: "1px solid var(--stroke-weak)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              השוואת שכונות
            </h3>
            <div style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 2 }}>
              {enriched.length} שכונות · ערכים מודגשים = הטוב ביותר במדד
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

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-heb)",
              fontSize: 13,
              minWidth: 360,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "start",
                    padding: "12px 16px",
                    background: "var(--grey-15)",
                    fontSize: 11,
                    color: "var(--grey-500)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  מדד
                </th>
                {enriched.map((n) => (
                  <th
                    key={n.id}
                    style={{
                      textAlign: "start",
                      padding: "12px 16px",
                      background: "var(--grey-15)",
                      borderInlineStart: "1px solid #fff",
                      minWidth: 130,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--grey-900)" }}>
                          {n.he}
                        </div>
                        {n.family && (
                          <div style={{ fontSize: 10, color: "var(--grey-500)", fontWeight: 500 }}>
                            {n.family}
                          </div>
                        )}
                      </div>
                      {enriched.length > 2 && (
                        <button
                          type="button"
                          onClick={() => onRemove(n.id)}
                          aria-label={`הסר את ${n.he} מההשוואה`}
                          className="mm-btn mm-btn-ghost mm-btn-sm"
                          style={{ padding: 4 }}
                        >
                          <MMIcon name="x" size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const values = enriched.map((n) => row.get(n));
                const best = pickBest(values, row.higherIsBetter);
                return (
                  <tr key={row.label}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderTop: "1px solid var(--grey-15)",
                        fontSize: 12,
                        color: "var(--grey-700)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.label}
                    </td>
                    {enriched.map((n, i) => {
                      const v = values[i];
                      const isBest = best !== null && v === best && best !== Infinity;
                      return (
                        <td
                          key={n.id}
                          style={{
                            padding: "12px 16px",
                            borderTop: "1px solid var(--grey-15)",
                            borderInlineStart: "1px solid var(--grey-15)",
                            fontFamily: "var(--font-inter, Inter)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: isBest ? 800 : 600,
                            color: isBest
                              ? row.label === "ציון התאמה"
                                ? scoreColor(v as number)
                                : "var(--green-positive)"
                              : "var(--grey-900)",
                            background: isBest ? "var(--green-bg)" : "#fff",
                          }}
                        >
                          {row.format(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          ההשוואה מבוססת על הפרסונה הנוכחית ({persona.name}). שינוי הפרסונה ב<a href="/onboarding" style={{ color: "var(--text-link)" }}>הגדרות</a> ישנה את ציון ההתאמה.
        </footer>
      </div>
    </div>
  );
}

type ComparisonRow<T> = {
  label: string;
  get: (n: T) => number;
  format: (v: number) => string;
  /** true=higher value wins; false=lower wins; null=don't highlight. */
  higherIsBetter: boolean | null;
};

function pickBest(values: number[], higherIsBetter: boolean | null): number | null {
  if (higherIsBetter === null) return null;
  const valid = values.filter((v) => v !== Infinity && !isNaN(v));
  if (valid.length === 0) return null;
  return higherIsBetter ? Math.max(...valid) : Math.min(...valid);
}

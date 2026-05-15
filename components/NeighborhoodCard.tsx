"use client";

import { MMIcon } from "@/lib/icons";
import { MatchBadge } from "./MatchBadge";
import { NIS, NISshort, pct } from "@/lib/format";

export type NeighborhoodCardData = {
  id: string;
  he: string;
  family: string | null;
  summary: string | null;
  matchScore: number;
  avgListing: number;
  avgPrice: number;
  avgPriceDelta: number;
  greenScore: number;
  schoolScore: number;
};

type Props = {
  n: NeighborhoodCardData;
  selected?: boolean;
  onClick?: () => void;
  variant?: "list" | "wide";
};

export function NeighborhoodCard({ n, selected, onClick, variant = "list" }: Props) {
  return (
    <div
      className="mm-card mm-card-hover"
      onClick={onClick}
      style={{
        padding: 14,
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 2px var(--pumpkin-orange)" : undefined,
        borderColor: selected ? "var(--pumpkin-orange)" : undefined,
        display: variant === "wide" ? "grid" : "block",
        gridTemplateColumns: variant === "wide" ? "1fr auto" : undefined,
        gap: 12,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{n.he}</h4>
          {n.family && (
            <span style={{ color: "var(--grey-500)", fontSize: 12 }}>· {n.family}</span>
          )}
          <div style={{ marginInlineStart: "auto" }}>
            <MatchBadge score={n.matchScore} />
          </div>
        </div>
        {n.summary && (
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--grey-700)", lineHeight: "18px" }}>
            {n.summary}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12,
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Stat label="חציון" value={NISshort(n.avgListing)} />
          <Stat
            label='מחיר/מ"ר'
            value={
              <>
                {NIS(n.avgPrice)}{" "}
                <span
                  className={n.avgPriceDelta > 0 ? "mm-up" : "mm-down"}
                  style={{ fontWeight: 700, fontSize: 11 }}
                >
                  {pct(n.avgPriceDelta)}
                </span>
              </>
            }
          />
          <Stat label="GreenScore" value={String(n.greenScore)} valueColor="var(--green-positive)" />
          <Stat label="בתי ספר" value={String(n.schoolScore)} />
        </div>
      </div>
      {variant === "wide" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
          <button className="mm-btn mm-btn-secondary mm-btn-sm">פרטים</button>
          <button className="mm-btn mm-btn-ghost mm-btn-sm">
            <MMIcon name="heart" size={12} /> שמירה
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueColor = "var(--grey-900)",
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div>
      <div style={{ color: "var(--grey-500)", fontWeight: 600, fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  );
}

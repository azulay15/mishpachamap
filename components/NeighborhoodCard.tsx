"use client";

import { MMIcon } from "@/lib/icons";
import { MatchBadge } from "./MatchBadge";
import { NIS, NISshort, pct } from "@/lib/format";
import { useFavorites } from "@/lib/useFavorites";

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
  /** Optional handler for clicking the match-score badge. */
  onExplainMatch?: () => void;
  variant?: "list" | "wide";
};

export function NeighborhoodCard({ n, selected, onClick, onExplainMatch, variant = "list" }: Props) {
  const deltaUp = n.avgPriceDelta > 0;
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();
  const isFav = hasNeighborhood(n.id);
  return (
    <div
      className="mm-card mm-card-hover"
      onClick={onClick}
      style={{
        padding: 14,
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 2px var(--pumpkin-orange)" : undefined,
        borderColor: selected ? "var(--pumpkin-orange)" : undefined,
        display: variant === "wide" ? "grid" : "flex",
        flexDirection: variant === "wide" ? undefined : "column",
        gridTemplateColumns: variant === "wide" ? "1fr auto" : undefined,
        gap: 12,
        height: "100%",
        minHeight: 200,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <button
            type="button"
            aria-label={isFav ? `הסר את ${n.he} מהשמורים` : `שמור את ${n.he}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleNeighborhood(n.id);
            }}
            style={{
              flex: "none",
              border: 0,
              background: "transparent",
              padding: 2,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: isFav ? "var(--pumpkin-orange)" : "var(--grey-500)",
            }}
          >
            <MMIcon name={isFav ? "heart-fill" : "heart"} size={14} color="currentColor" />
          </button>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{n.he}</h4>
          {n.family && (
            <span
              style={{
                color: "var(--grey-500)",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              · {n.family}
            </span>
          )}
          <div style={{ marginInlineStart: "auto", flex: "none" }}>
            <MatchBadge score={n.matchScore} onClick={onExplainMatch} />
          </div>
        </div>
        {n.summary && (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: "var(--grey-700)",
              lineHeight: "18px",
              flex: 1,
              minHeight: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {n.summary}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
            marginTop: "auto",
          }}
        >
          <StatPill icon="home" label="חציון" value={NISshort(n.avgListing)} />
          <StatPill
            icon="tag"
            label='מחיר/מ"ר'
            value={NIS(n.avgPrice)}
            badge={
              <span className={deltaUp ? "mm-up" : "mm-down"} style={{ fontSize: 10, fontWeight: 700 }}>
                {pct(n.avgPriceDelta)}
              </span>
            }
          />
          <StatPill
            icon="leaf"
            label="GreenScore"
            value={String(n.greenScore)}
            valueColor="var(--green-positive)"
            accent="var(--green-positive)"
          />
          <StatPill
            icon="school"
            label="בתי ספר"
            value={String(n.schoolScore)}
            accent="var(--layer-school)"
          />
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

function StatPill({
  icon,
  label,
  value,
  badge,
  valueColor = "var(--grey-900)",
  accent = "var(--grey-500)",
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
  valueColor?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        alignItems: "center",
        gap: 6,
        padding: "6px 8px",
        borderRadius: 6,
        background: "var(--grey-15)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "#fff",
          flex: "none",
        }}
      >
        <MMIcon name={icon} size={11} color={accent} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--grey-500)",
            fontWeight: 600,
            lineHeight: "12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 12,
            color: valueColor,
            lineHeight: "14px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            direction: "ltr",
            textAlign: "start",
          }}
        >
          {value}
        </div>
        {badge && (
          <div style={{ lineHeight: "12px", marginTop: 1 }}>{badge}</div>
        )}
      </div>
    </div>
  );
}

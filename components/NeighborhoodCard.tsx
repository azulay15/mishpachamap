"use client";

import { MMIcon } from "@/lib/icons";
import { NISshort } from "@/lib/format";
import { useFavorites } from "@/lib/useFavorites";
import { scoreColor } from "@/lib/match";

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
  /** Click handler for the match score region — opens the breakdown sheet. */
  onExplainMatch?: () => void;
  /** Whether this card is currently in the comparison set. */
  inCompare?: boolean;
  /** Toggle this card's membership in the comparison set. */
  onToggleCompare?: () => void;
  variant?: "list" | "wide";
};

export function NeighborhoodCard({
  n,
  selected,
  onClick,
  onExplainMatch,
  inCompare,
  onToggleCompare,
  variant = "list",
}: Props) {
  const { hasNeighborhood, toggleNeighborhood } = useFavorites();
  const isFav = hasNeighborhood(n.id);
  const matchTint = scoreColor(n.matchScore);

  return (
    <article
      className="mm-card mm-card-hover"
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={onClick ? `שכונת ${n.he}, ציון התאמה ${n.matchScore} מתוך 100` : undefined}
      style={{
        ...cardStyle,
        ...(selected ? selectedStyle : {}),
        ...(variant === "wide"
          ? { display: "grid", gridTemplateColumns: "1fr auto", gap: 16 }
          : {}),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
        {/* Header: heart + (optional compare toggle) + name + family + match-score ring */}
        <header style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "start" }}>
          <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <button
              type="button"
              aria-label={isFav ? `הסר את ${n.he} מהשמורים` : `שמור את ${n.he}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleNeighborhood(n.id);
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: 0,
                background: isFav ? "rgba(255,107,0,0.10)" : "var(--grey-15)",
                color: isFav ? "var(--pumpkin-orange)" : "var(--grey-500)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                transition: "background 120ms, color 120ms",
                flex: "none",
              }}
            >
              <MMIcon name={isFav ? "heart-fill" : "heart"} size={13} color="currentColor" />
            </button>
            {onToggleCompare && (
              <button
                type="button"
                aria-label={inCompare ? `הסר את ${n.he} מההשוואה` : `הוסף את ${n.he} להשוואה`}
                aria-pressed={inCompare}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCompare();
                }}
                title={inCompare ? "בהשוואה" : "הוסף להשוואה"}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: 0,
                  background: inCompare ? "var(--grey-900)" : "var(--grey-15)",
                  color: inCompare ? "#fff" : "var(--grey-500)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  transition: "background 120ms, color 120ms",
                  flex: "none",
                }}
              >
                <MMIcon name="compare" size={13} color="currentColor" />
              </button>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "var(--grey-900)",
                letterSpacing: "-0.01em",
                lineHeight: "22px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {n.he}
            </h4>
            {n.family && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--grey-700)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: "16px",
                }}
                title={n.family}
              >
                {n.family}
              </div>
            )}
          </div>

          <MatchRing score={n.matchScore} color={matchTint} onClick={onExplainMatch} />
        </header>

        {/* Summary — clamped to 2 lines. Card has its own min-height so all cards line up. */}
        {n.summary && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--grey-700)",
              lineHeight: "18px",
              flex: 1,
              minHeight: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {n.summary}
          </p>
        )}

        {/* Stats grid — 2×2 by default (works at 260-340px card widths),
             expands to 4-across on wide variants. */}
        <div
          className="mm-card-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 8,
            columnGap: 0,
            paddingTop: 10,
            borderTop: "1px solid var(--grey-15)",
            marginTop: "auto",
          }}
        >
          <Stat value={NISshort(n.avgListing)} label="חציון" />
          <Stat value={`₪${(n.avgPrice / 1000).toFixed(1)}K`} label='למ"ר' border />
          <Stat value={n.schoolScore} label="בתי ספר" />
          <Stat
            value={n.greenScore}
            label="GreenScore"
            valueColor="var(--green-positive)"
            border
          />
        </div>
      </div>

      {variant === "wide" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
          <button className="mm-btn mm-btn-secondary mm-btn-sm">פרטים</button>
        </div>
      )}
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  cursor: "pointer",
  height: "100%",
  minHeight: 230,
  display: "flex",
  flexDirection: "column",
  transition: "transform 160ms cubic-bezier(.4,0,.2,1), box-shadow 160ms",
};

const selectedStyle: React.CSSProperties = {
  boxShadow: "0 0 0 2px var(--pumpkin-orange), var(--shadow-md)",
  borderColor: "var(--pumpkin-orange)",
};

/**
 * Compact circular score ring. Click → opens the match breakdown sheet.
 * Larger than the inline number — it's the card's visual focal point.
 */
function MatchRing({
  score,
  color,
  onClick,
}: {
  score: number;
  color: string;
  onClick?: () => void;
}) {
  const size = 42;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={
        onClick
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={onClick ? "לחצו לפירוט ההתאמה" : undefined}
      style={{
        position: "relative",
        width: size,
        height: size,
        border: 0,
        background: "transparent",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
        flex: "none",
      }}
    >
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grey-15)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          fontWeight: 800,
          color: "var(--grey-900)",
          fontFamily: "var(--font-inter, Inter)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {score}
      </div>
    </Tag>
  );
}

function Stat({
  value,
  label,
  sub,
  subColor = "var(--grey-500)",
  valueColor = "var(--grey-900)",
  border,
}: {
  value: React.ReactNode;
  label: string;
  sub?: React.ReactNode;
  subColor?: string;
  valueColor?: string;
  border?: boolean;
}) {
  return (
    <div
      style={{
        padding: "0 8px",
        borderInlineStart: border ? "1px solid var(--grey-15)" : "0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: valueColor,
          fontFamily: "var(--font-inter, Inter)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: "16px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--grey-500)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          lineHeight: "12px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: subColor,
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
            marginTop: 1,
            lineHeight: "12px",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

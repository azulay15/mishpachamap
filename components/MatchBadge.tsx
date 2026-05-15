"use client";

import { MMIcon } from "@/lib/icons";
import { scoreColor } from "@/lib/match";

type Props = {
  score: number;
  /** Optional click handler — when provided, the badge becomes a button that
   *  typically opens the persona-aware match breakdown sheet. */
  onClick?: (e: React.MouseEvent) => void;
};

export function MatchBadge({ score, onClick }: Props) {
  const color = scoreColor(score);
  const bg =
    color === "var(--green-positive)"
      ? "var(--green-bg)"
      : color === "var(--pumpkin-orange)"
        ? "rgba(255,107,0,0.10)"
        : "var(--grey-15)";

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    background: bg,
    color,
    fontWeight: 800,
    fontSize: 12,
    fontFamily: "var(--font-inter, Inter)",
    fontVariantNumeric: "tabular-nums",
    border: 0,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title="לחצו לפירוט ההתאמה"
        style={{ ...baseStyle, cursor: "pointer" }}
      >
        <MMIcon name="sparkle" size={12} color={color} />
        {score}/100 התאמה
      </button>
    );
  }
  return (
    <div style={baseStyle}>
      <MMIcon name="sparkle" size={12} color={color} />
      {score}/100 התאמה
    </div>
  );
}

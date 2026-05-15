import { MMIcon } from "@/lib/icons";
import { scoreColor } from "@/lib/match";

export function MatchBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  const bg =
    color === "var(--green-positive)"
      ? "var(--green-bg)"
      : color === "var(--pumpkin-orange)"
        ? "rgba(255,107,0,0.10)"
        : "var(--grey-15)";

  return (
    <div
      style={{
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
      }}
    >
      <MMIcon name="sparkle" size={12} color={color} />
      {score}/100 התאמה
    </div>
  );
}

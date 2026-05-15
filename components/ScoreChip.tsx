type Props = {
  value: number;
  label?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
};

export function ScoreChip({ value, label, color = "var(--green-positive)", size = "sm" }: Props) {
  const ringSize = size === "lg" ? 64 : size === "md" ? 48 : 36;
  const stroke = size === "lg" ? 6 : size === "md" ? 5 : 4;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const fontSize = size === "lg" ? 18 : size === "md" ? 14 : 11;
  const textOffset = size === "lg" ? 6 : size === "md" ? 4 : 3;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={ringSize} height={ringSize} style={{ flex: "none" }}>
        <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="var(--grey-15)" strokeWidth={stroke} />
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
        <text
          x={ringSize / 2}
          y={ringSize / 2 + textOffset}
          textAnchor="middle"
          style={{
            fontSize,
            fontWeight: 800,
            fill: "var(--grey-900)",
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </text>
      </svg>
      {label && (
        <div style={{ fontSize: 12, color: "var(--grey-700)", fontWeight: 600 }}>{label}</div>
      )}
    </div>
  );
}

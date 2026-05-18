/**
 * Saved view skeleton — header + grid of placeholder cards.
 */
export default function Loading() {
  return (
    <div className="mm-shell" style={{ minHeight: "100vh" }}>
      <div
        style={{
          height: 56,
          background: "#fff",
          borderBottom: "1px solid var(--stroke-weak)",
        }}
      />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 24 }}>
          <Skeleton w={120} h={28} />
          <Skeleton w={180} h={14} />
        </div>
        <Skeleton w="40%" h={18} style={{ marginBottom: 12 }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} w="100%" h={120} radius={8} />
          ))}
        </div>
      </main>
    </div>
  );
}

function Skeleton({
  w,
  h,
  radius = 4,
  style,
}: {
  w: number | string;
  h: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, var(--grey-15) 0%, #ECECEE 50%, var(--grey-15) 100%)",
        backgroundSize: "200% 100%",
        animation: "mm-skel 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/**
 * Map page loading skeleton. Mirrors the real layout — header bar + map area
 * + right rail — so the layout doesn't shift when the server-fetched data
 * arrives.
 */
export default function Loading() {
  return (
    <div
      className="mm-shell"
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden",
      }}
    >
      {/* Header bar skeleton */}
      <div style={{ height: 56, background: "#fff", borderBottom: "1px solid var(--stroke-weak)" }}>
        <div style={{ height: "100%", display: "flex", alignItems: "center", padding: "0 24px", gap: 24 }}>
          <Skeleton w={140} h={20} />
          <div style={{ display: "flex", gap: 16, marginInlineStart: 32 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} w={48} h={14} />
            ))}
          </div>
          <Skeleton w={280} h={32} radius={6} style={{ marginInlineStart: "auto" }} />
          <Skeleton w={100} h={32} radius={6} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gridTemplateRows: "100%",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Map area */}
        <div style={{ position: "relative", background: "var(--map-bg)", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 16,
              insetInlineStart: "50%",
              transform: "translateX(50%)",
              display: "flex",
              gap: 8,
            }}
          >
            <Skeleton w={320} h={36} radius={8} />
            <Skeleton w={140} h={36} radius={999} />
          </div>
          {/* Carousel placeholders */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              right: 14,
              display: "flex",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} w={280} h={230} radius={10} />
            ))}
          </div>
        </div>

        {/* Right rail */}
        <div
          style={{
            background: "#fff",
            borderInlineStart: "1px solid var(--stroke-weak)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Skeleton w="60%" h={22} />
          <Skeleton w="40%" h={14} />
          <Skeleton w="100%" h={56} radius={6} />
          <Skeleton w="100%" h={1} />
          <Skeleton w="40%" h={16} style={{ marginTop: 8 }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} w="100%" h={72} radius={6} />
          ))}
        </div>
      </div>
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

/**
 * הנחלה logo — "נבט משפחתי" (family sprout): ground line, stem, two leaves and
 * a bud. Shape 1, Rubik wordmark, colour 1 (leaf green + bud orange).
 * Colours come from the --hn-logo-* tokens in styles/hanachala.css, so the
 * mark follows the theme. Below 20px the strokes thicken to stay legible.
 */

type MarkProps = { size?: number; className?: string };

export function SproutMark({ size = 28, className }: MarkProps) {
  const small = size <= 20;
  const stroke = small ? 4 : 3;
  const leaf = { stroke: "var(--hn-logo-leaf)" };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ flex: "none", display: "block" }}
    >
      <path d="M8 41q16-6 32 0" style={leaf} strokeWidth={stroke} strokeLinecap="round" />
      <path d="M24 38V19" style={leaf} strokeWidth={stroke} strokeLinecap="round" />
      <path d="M23.5 31C14 31 8.5 25 8.5 17c8.5 0 15 5.5 15 14z" style={{ fill: "var(--hn-logo-leaf)" }} />
      <path d="M24.5 26c9.5 0 15-6 15-14-8.5 0-15 5.5-15 14z" style={{ fill: "var(--hn-logo-leaf)" }} />
      <circle cx="24" cy="12.5" r={small ? 5.5 : 4.6} style={{ fill: "var(--hn-logo-bud)" }} />
    </svg>
  );
}

/** Mark + wordmark. Inherits font-size from its parent unless `fontSize` is set. */
export function BrandLogo({
  size = 30,
  fontSize,
  className,
}: {
  size?: number;
  fontSize?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--hn-font-display)",
        fontWeight: 700,
        lineHeight: 1,
        color: "var(--hn-text)",
        fontSize,
      }}
    >
      <SproutMark size={size} />
      <span>הנחלה</span>
    </span>
  );
}

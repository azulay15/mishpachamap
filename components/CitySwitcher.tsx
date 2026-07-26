"use client";

import { useEffect, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { CITIES, type City } from "@/lib/cities";

/**
 * Floating city switcher for the map. Shows the current city and, on tap, a
 * menu of all cities — live ones navigate to `/map/[slug]`, "coming-soon" ones
 * are listed but disabled with a בקרוב tag. Lives top-start on the map so it
 * doesn't compete with the centered layers/search/persona overlay row.
 */
export function CitySwitcher({ city }: { city: City }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", zIndex: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          border: 0,
          borderRadius: 8,
          padding: "8px 12px",
          boxShadow: "var(--shadow-md)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--grey-900)",
        }}
      >
        <MMIcon name="pin" size={15} color="var(--pumpkin-orange)" />
        <span>{city.name_he}</span>
        <MMIcon
          name="chevron-down"
          size={14}
          color="#84888E"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            insetInlineStart: 0,
            minWidth: 220,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--grey-500)", padding: "6px 10px 4px" }}>
            בחרו עיר
          </div>
          {CITIES.map((c) => {
            const isCurrent = c.id === city.id;
            const isLive = c.status === "live";
            const inner = (
              <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                <MMIcon
                  name="pin"
                  size={14}
                  color={isCurrent ? "var(--pumpkin-orange)" : isLive ? "#84888E" : "var(--grey-300, #C9CDD4)"}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isCurrent ? 800 : 600,
                      color: isLive ? "var(--grey-900)" : "var(--grey-500)",
                    }}
                  >
                    {c.name_he}
                  </div>
                  {c.tagline_he && (
                    <div style={{ fontSize: 10.5, color: "var(--grey-500)" }}>{c.tagline_he}</div>
                  )}
                </div>
                {!isLive && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--grey-500)",
                      background: "var(--grey-15, #F1F2F4)",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    בקרוב
                  </span>
                )}
                {isCurrent && <MMIcon name="check" size={14} color="var(--pumpkin-orange)" />}
              </div>
            );

            const rowStyle: React.CSSProperties = {
              display: "flex",
              alignItems: "center",
              borderRadius: 7,
              padding: "8px 10px",
              textDecoration: "none",
              background: isCurrent ? "var(--grey-15, #F1F2F4)" : "transparent",
            };

            if (!isLive) {
              return (
                <div key={c.id} style={{ ...rowStyle, cursor: "default", opacity: 0.85 }} aria-disabled>
                  {inner}
                </div>
              );
            }
            return (
              <a
                key={c.id}
                href={`/map/${c.slug}`}
                role="option"
                aria-selected={isCurrent}
                style={rowStyle}
                onClick={() => setOpen(false)}
              >
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

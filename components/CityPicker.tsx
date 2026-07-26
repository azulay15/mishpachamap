"use client";

import { useMemo, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { CITIES } from "@/lib/cities";

/**
 * National city picker for the Home page — search + a grid of city cards driven
 * by the static registry (lib/cities.ts). Live cities link to their map; cities
 * whose data isn't built yet show a בקרוב badge. This is the "choose your city"
 * entry point that makes the product feel national rather than Modi'in-only.
 *
 * `variant="hero"` is the full picker (eyebrow + heading + search); "compact"
 * drops the heading for use on the returning-visitor dashboard.
 */
export function CityPicker({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return CITIES;
    return CITIES.filter(
      (c) =>
        c.name_he.includes(needle) ||
        c.name_en.toLowerCase().includes(needle) ||
        c.slug.includes(needle),
    );
  }, [q]);

  return (
    <section aria-label="בחירת עיר" style={{ marginTop: variant === "hero" ? "clamp(28px, 4vw, 44px)" : 8 }}>
      {variant === "hero" && (
        <>
          <p className="mm-home-eyebrow">כל הארץ</p>
          <h2 className="mm-home-h2">באיזו עיר מחפשים?</h2>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--grey-500)" }}>
            מתחילים במודיעין ואור יהודה — ערים נוספות בדרך.
          </p>
        </>
      )}

      <div
        className="mm-input"
        style={{ width: "100%", maxWidth: 420, height: 44, marginBottom: 16 }}
      >
        <MMIcon name="search" size={16} color="#84888E" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חפשו עיר בישראל…"
          aria-label="חיפוש עיר"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {matches.map((c) => {
          const isLive = c.status === "live";
          const body = (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      flex: "none",
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: isLive ? "var(--pumpkin-orange)" : "var(--grey-15, #F1F2F4)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <MMIcon name="pin" size={19} color={isLive ? "#fff" : "#84888E"} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: "var(--grey-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name_he}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--grey-500)" }}>{c.name_en}</div>
                  </div>
                </div>
                {!isLive && (
                  <span
                    style={{
                      flex: "none",
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: "var(--grey-500)",
                      background: "var(--grey-15, #F1F2F4)",
                      borderRadius: 999,
                      padding: "3px 9px",
                    }}
                  >
                    בקרוב
                  </span>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: "var(--grey-700)", fontWeight: 600 }}>
                  {c.tagline_he ?? ""}
                </span>
                {isLive && (
                  <span className="go" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 800, color: "var(--pumpkin-orange)" }}>
                    למפה
                    <MMIcon name="chevron-left" size={13} color="var(--pumpkin-orange)" />
                  </span>
                )}
              </div>
            </>
          );

          if (!isLive) {
            return (
              <div key={c.id} className="mm-home-card" style={{ padding: 16, opacity: 0.72, cursor: "default" }} aria-disabled>
                {body}
              </div>
            );
          }
          return (
            <a key={c.id} href={`/map/${c.slug}`} className="mm-home-card mm-home-cardlink" style={{ padding: 16 }}>
              {body}
            </a>
          );
        })}

        {matches.length === 0 && (
          <div className="mm-home-card" style={{ padding: 16, color: "var(--grey-500)", fontSize: 13 }}>
            העיר הזו עוד לא זמינה — אנחנו מרחיבים את המפה לכל הארץ. בקרוב.
          </div>
        )}
      </div>
    </section>
  );
}

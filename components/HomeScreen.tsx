"use client";

import { useEffect, useMemo, useState } from "react";
import { MMHeader } from "./MMHeader";
import { MatchBadge } from "./MatchBadge";
import { MMIcon } from "@/lib/icons";
import { usePersona } from "@/lib/usePersona";
import { useFavorites } from "@/lib/useFavorites";
import { breakdownFor, totalScore } from "@/lib/match";
import type { ConciergeData } from "./ConciergeScreen";

const PERSONA_KEY = "mishpachamap.persona.v1";

type Props = { data: ConciergeData };
type RankedNeighborhood = ConciergeData["neighborhoods"][number];

/**
 * Home (`/`) — hybrid landing page.
 *
 * Server-renders the first-time-visitor hero (also what crawlers see). After
 * hydration, if a persona was saved by onboarding (localStorage), the page
 * switches to a personalized dashboard. The map lives at /map.
 *
 * The hero art is the product itself: an SVG of the real CBS-derived
 * neighborhood polygons, projected straight from the GeoJSON the map uses.
 */
export function HomeScreen({ data }: Props) {
  const persona = usePersona();
  const { favs } = useFavorites();
  const [hasPersona, setHasPersona] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setHasPersona(window.localStorage.getItem(PERSONA_KEY) !== null);
    check();
    window.addEventListener("mishpachamap.persona.change", check);
    return () => window.removeEventListener("mishpachamap.persona.change", check);
  }, []);

  // Re-rank neighborhoods with the visitor's persona (client-side, same logic
  // as the map screen). Until hydration this uses the default persona — which
  // is exactly what the server rendered, so there is no mismatch.
  const ranked = useMemo(() => {
    return data.neighborhoods
      .map((n) => ({
        ...n,
        matchScore: Math.min(99, totalScore(breakdownFor(n.facts, persona))),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [data.neighborhoods, persona]);

  // Real, countable stats — zero-valued ones are hidden rather than shown.
  const stats = useMemo(() => {
    const listings = Object.values(data.listingsByNeighborhood).reduce((s, arr) => s + arr.length, 0);
    const schoolIds = new Set<string>();
    for (const arr of Object.values(data.schoolsByNeighborhood)) for (const s of arr) schoolIds.add(s.id);
    return [
      { icon: "pin", value: data.neighborhoods.length, label: "שכונות" },
      { icon: "home", value: listings, label: "נכסים פעילים" },
      { icon: "school", value: schoolIds.size, label: "בתי ספר" },
      { icon: "tree", value: data.pois.length, label: "נקודות עניין במפה" },
    ].filter((s) => s.value > 0);
  }, [data]);

  const market = useMemo(() => {
    const prices = data.neighborhoods.map((n) => n.avgPrice).filter((p) => p > 0).sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const deltas = data.neighborhoods.map((n) => n.avgPriceDelta).filter((d) => d !== 0);
    const avgDelta = deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
    return { medianM2: median, avgDelta };
  }, [data.neighborhoods]);

  return (
    <div className="mm-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #F6F4EF)" }}>
      <MMHeader activeNav="בית" />
      <main style={{ flex: 1, width: "100%", maxWidth: 1120, margin: "0 auto", padding: "clamp(16px, 3.5vw, 40px) clamp(16px, 3vw, 32px) 64px" }}>
        {hasPersona ? (
          <Dashboard
            personaName={persona.name}
            ranked={ranked}
            favNeighborhoods={favs.neighborhoods}
            favListings={favs.listings}
            market={market}
            data={data}
          />
        ) : (
          <Hero stats={stats} ranked={ranked} />
        )}
      </main>
      <footer style={{ padding: "16px 24px", borderTop: "1px solid var(--stroke-weak)", fontSize: 11.5, color: "var(--grey-500)", textAlign: "center" }}>
        גבולות השכונות מבוססים על אזורים סטטיסטיים של הלמ״ס (2022). חלק מנתוני הנכסים הם נתוני הדגמה.
      </footer>
    </div>
  );
}

/* ================= city map (real polygons as art) ================= */

type Projected = {
  width: number;
  height: number;
  paths: { id: string; d: string }[];
  centroids: Map<string, { x: number; y: number }>;
};

function projectCity(neighborhoods: RankedNeighborhood[]): Projected | null {
  const rings = neighborhoods
    .map((n) => ({ id: n.id, ring: n.polygon?.coordinates?.[0] as [number, number][] | undefined }))
    .filter((r): r is { id: string; ring: [number, number][] } => Array.isArray(r.ring) && r.ring.length >= 4);
  if (rings.length === 0) return null;

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const { ring } of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * kx;
  const spanY = maxLat - minLat;
  const W = 420;
  const H = Math.round((W * spanY) / spanX);
  const pad = 0.045;
  const sx = (W * (1 - 2 * pad)) / spanX;
  const sy = (H * (1 - 2 * pad)) / spanY;
  const px = (lng: number) => W * pad + (lng - minLng) * kx * sx;
  const py = (lat: number) => H * pad + (maxLat - lat) * sy;

  const paths: Projected["paths"] = [];
  const centroids = new Map<string, { x: number; y: number }>();
  for (const { id, ring } of rings) {
    const d =
      ring
        .map(([lng, lat], i) => `${i === 0 ? "M" : "L"}${px(lng).toFixed(1)} ${py(lat).toFixed(1)}`)
        .join("") + "Z";
    paths.push({ id, d });
    let cx = 0, cy = 0;
    for (const [lng, lat] of ring) { cx += px(lng); cy += py(lat); }
    centroids.set(id, { x: cx / ring.length, y: cy / ring.length });
  }
  return { width: W, height: H, paths, centroids };
}

/** The hero visual: every real neighborhood polygon, top matches highlighted. */
function CityMap({ ranked }: { ranked: RankedNeighborhood[] }) {
  const proj = useMemo(() => projectCity(ranked), [ranked]);
  if (!proj) return null;
  const topIds = ranked.slice(0, 3).map((n) => n.id);
  const top1 = ranked[0];
  const top2 = ranked[1];

  const pill = (n: RankedNeighborhood | undefined) => {
    if (!n) return null;
    const c = proj.centroids.get(n.id);
    if (!c) return null;
    return {
      left: `${(c.x / proj.width) * 100}%`,
      top: `${(c.y / proj.height) * 100}%`,
      label: n.he,
      score: n.matchScore,
    };
  };
  const p1 = pill(top1);
  const p2 = pill(top2);

  return (
    <div dir="ltr" style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${proj.width} ${proj.height}`}
        role="img"
        aria-label="מפת השכונות של מודיעין־מכבים־רעות"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {proj.paths.map(({ id, d }) => {
          const isTop = topIds.includes(id);
          const isFirst = id === top1?.id;
          return (
            <path
              key={id}
              d={d}
              fill="#9BC97E"
              fillOpacity={isFirst ? 0.72 : isTop ? 0.6 : 0.42}
              stroke={isFirst ? "var(--pumpkin-orange)" : "#FFFFFF"}
              strokeWidth={isFirst ? 2.4 : 1.3}
              strokeDasharray={isFirst ? "7 3.5" : undefined}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      {p1 && (
        <div className="mm-home-float" style={{ left: p1.left, top: p1.top, transform: "translate(-50%, -120%)" }} dir="rtl">
          <MMIcon name="sparkle" size={12} color="var(--pumpkin-orange)" />
          {p1.label} · {p1.score}
        </div>
      )}
      {p2 && (
        <div className="mm-home-float" style={{ left: p2.left, top: p2.top, transform: "translate(-50%, 30%)" }} dir="rtl">
          {p2.label} · {p2.score}
        </div>
      )}
      <div
        className="mm-home-float"
        style={{ left: 12, bottom: 10, top: "auto", fontWeight: 600, color: "var(--grey-500)", fontSize: 11 }}
        dir="rtl"
      >
        גבולות אמיתיים · למ״ס 2022
      </div>
    </div>
  );
}

/** Small single-polygon thumbnail for neighborhood cards. */
function MiniPoly({ polygon }: { polygon: GeoJSON.Polygon }) {
  const d = useMemo(() => {
    const ring = polygon?.coordinates?.[0] as [number, number][] | undefined;
    if (!ring || ring.length < 4) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const S = 52, pad = 6;
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const s = (S - pad * 2) / span;
    const ox = (S - (maxX - minX) * s) / 2;
    const oy = (S - (maxY - minY) * s) / 2;
    return (
      ring
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(ox + (x - minX) * s).toFixed(1)} ${(oy + (maxY - y) * s).toFixed(1)}`)
        .join("") + "Z"
    );
  }, [polygon]);
  if (!d) return null;
  return (
    <span
      aria-hidden
      style={{
        flex: "none",
        width: 52,
        height: 52,
        borderRadius: 12,
        background: "var(--map-bg, #F4EFE3)",
        border: "1px solid var(--stroke-hairline)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg viewBox="0 0 52 52" width="44" height="44">
        <path d={d} fill="#9BC97E" fillOpacity="0.6" stroke="#5B9F40" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ================= first-time visitor ================= */

function Hero({
  stats,
  ranked,
}: {
  stats: { icon: string; value: number; label: string }[];
  ranked: RankedNeighborhood[];
}) {
  const top3 = ranked.slice(0, 3);
  return (
    <>
      <section className="mm-home-hero">
        <div className="mm-home-rise">
          <div className="mm-home-kicker">מודיעין־מכבים־רעות</div>
          <h1 className="mm-home-h1">
            מוצאים את השכונה שמתאימה <span className="hl">בדיוק</span> למשפחה שלכם
          </h1>
          <p className="mm-home-sub">
            מספרים לנו מה חשוב לכם — תקציב, בתי ספר, פארקים, שקט — ואנחנו מדרגים כל שכונה
            בעיר לפי ההתאמה אליכם, על מפה אחת עם כל הנתונים.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
            <a
              href="/onboarding"
              className="mm-btn mm-btn-accent"
              style={{ textDecoration: "none", padding: "12px 22px", fontSize: 15, borderRadius: 12 }}
            >
              <MMIcon name="sparkle" size={16} color="#fff" />
              בנו את פרופיל המשפחה
            </a>
            <a
              href="/map"
              className="mm-btn mm-btn-secondary"
              style={{ textDecoration: "none", color: "var(--grey-900)", padding: "12px 20px", fontSize: 15, borderRadius: 12 }}
            >
              <MMIcon name="map" size={16} />
              ישר למפה
            </a>
          </div>
        </div>

        <div className="mm-home-heromap mm-home-rise mm-home-rise-2">
          <div className="mm-home-heromap-card">
            <CityMap ranked={ranked} />
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section aria-label="נתונים במערכת" className="mm-home-statstrip mm-home-rise mm-home-rise-3">
          {stats.map((s) => (
            <div key={s.label} className="mm-home-stat">
              <div className="num">{s.value.toLocaleString("he-IL")}</div>
              <div className="lbl">{s.label}</div>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: "clamp(34px, 5vw, 52px)" }} className="mm-home-rise mm-home-rise-4">
        <p className="mm-home-eyebrow">שלושה צעדים</p>
        <h2 className="mm-home-h2">איך זה עובד</h2>
        <div className="mm-home-steps">
          <StepCard n={1} title="מספרים על המשפחה" body="תקציב, גילאי הילדים ומה חובה שיהיה ליד הבית — שתי דקות בטופס קצר." />
          <StepCard n={2} title="מקבלים דירוג התאמה" body="כל שכונה מקבלת ציון אישי לפי מרחקי הליכה אמיתיים לבתי ספר, פארקים ותחבורה." />
          <StepCard n={3} title="חוקרים במפה ושומרים" body="משווים שכונות, בודקים נכסים, ושואלים את מומחה השכונה החכם כל שאלה." />
        </div>
      </section>

      {top3.length > 0 && (
        <section style={{ marginTop: "clamp(34px, 5vw, 52px)" }}>
          <p className="mm-home-eyebrow">מובילות כרגע</p>
          <h2 className="mm-home-h2">שכונות מובילות למשפחות</h2>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--grey-500)" }}>
            לפי פרופיל משפחתי טיפוסי — בנו פרופיל משלכם לדירוג אישי.
          </p>
          <TopMatchGrid top={top3} />
        </section>
      )}
    </>
  );
}

/* ================= returning visitor ================= */

function Dashboard({
  personaName,
  ranked,
  favNeighborhoods,
  favListings,
  market,
  data,
}: {
  personaName: string;
  ranked: RankedNeighborhood[];
  favNeighborhoods: string[];
  favListings: string[];
  market: { medianM2: number; avgDelta: number };
  data: ConciergeData;
}) {
  const top3 = ranked.slice(0, 3);
  const nbById = new Map(data.neighborhoods.map((n) => [n.id, n]));
  const savedNbNames = favNeighborhoods.map((id) => nbById.get(id)?.he).filter(Boolean) as string[];

  return (
    <>
      <section className="mm-home-rise" style={{ margin: "4px 0 24px" }}>
        <p className="mm-home-eyebrow">הדירוג האישי שלכם</p>
        <h1 className="mm-home-h1" style={{ fontSize: "clamp(26px, 3.6vw, 38px)" }}>
          שלום, <span className="hl">{personaName}</span>
        </h1>
        <p className="mm-home-sub" style={{ marginTop: 8 }}>
          אלו השכונות שהכי מתאימות לפרופיל שלכם היום.
        </p>
      </section>

      <div className="mm-home-rise mm-home-rise-2">
        <TopMatchGrid top={top3} />
      </div>

      <section
        className="mm-home-rise mm-home-rise-3"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}
      >
        <a href="/saved" className="mm-home-card mm-home-cardlink">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "var(--grey-900)" }}>
            <MMIcon name="heart-fill" size={16} color="var(--pumpkin-orange)" />
            השמורים שלכם
          </div>
          <div style={{ fontSize: 13, color: "var(--grey-700)", marginTop: 6, lineHeight: 1.5 }}>
            {favNeighborhoods.length + favListings.length === 0
              ? "עדיין לא שמרתם כלום — לחצו על ♥ ליד שכונה או נכס במפה."
              : `${favNeighborhoods.length} שכונות · ${favListings.length} נכסים${savedNbNames.length ? " — " + savedNbNames.slice(0, 3).join(", ") : ""}`}
          </div>
        </a>

        <div className="mm-home-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "var(--grey-900)" }}>
            <MMIcon name="trend-up" size={16} color="var(--green-positive, #0E7C5A)" />
            תמונת שוק
          </div>
          <div style={{ fontSize: 13, color: "var(--grey-700)", marginTop: 6, lineHeight: 1.6 }}>
            מחיר חציוני למ״ר: <strong style={{ fontFamily: "var(--font-inter, Inter)" }}>₪{market.medianM2.toLocaleString("he-IL")}</strong>
            <br />
            שינוי שנתי ממוצע: <strong style={{ fontFamily: "var(--font-inter, Inter)" }}>{market.avgDelta >= 0 ? "+" : ""}{market.avgDelta.toFixed(1)}%</strong>
          </div>
        </div>

        <a href="/map" className="mm-home-card mm-home-cardlink">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "var(--grey-900)" }}>
            <MMIcon name="sparkle" size={16} color="var(--pumpkin-orange)" />
            מומחה השכונה
          </div>
          <div style={{ fontSize: 13, color: "var(--grey-700)", marginTop: 6, lineHeight: 1.5 }}>
            שאלו כל שאלה — ״איפה הכי קרוב לבית ספר דתי?״ — וקבלו תשובה מבוססת נתונים במפה.
          </div>
        </a>
      </section>

      <a
        href="/map"
        className="mm-btn mm-btn-accent mm-home-rise mm-home-rise-4"
        style={{ textDecoration: "none", marginTop: 24, display: "inline-flex", padding: "12px 22px", fontSize: 15, borderRadius: 12 }}
      >
        <MMIcon name="map" size={16} color="#fff" />
        לכל השכונות במפה
      </a>
    </>
  );
}

/* ================= shared pieces ================= */

function TopMatchGrid({ top }: { top: RankedNeighborhood[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {top.map((n, i) => (
        <a key={n.id} href={`/map?n=${n.id}`} className="mm-home-card mm-home-cardlink" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span
                aria-hidden
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: i === 0 ? "var(--pumpkin-orange)" : "var(--grey-15)",
                  color: i === 0 ? "#fff" : "var(--grey-700)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 13,
                  fontFamily: "var(--font-inter, Inter)",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontWeight: 800, fontSize: 17, color: "var(--grey-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.he}
              </span>
            </div>
            <MatchBadge score={n.matchScore} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {n.family && (
                <div style={{ fontSize: 12.5, color: "var(--grey-500)", fontWeight: 700 }}>{n.family}</div>
              )}
              {n.summary && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--grey-700)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {n.summary}
                </p>
              )}
            </div>
            <MiniPoly polygon={n.polygon} />
          </div>

          <span
            className="go"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, fontSize: 12.5, fontWeight: 800, color: "var(--pumpkin-orange)" }}
          >
            צפו במפה
            <MMIcon name="chevron-left" size={13} color="var(--pumpkin-orange)" />
          </span>
        </a>
      ))}
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="mm-home-step">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="dot" aria-hidden>{n}</span>
        <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--grey-900)" }}>{title}</span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--grey-700)" }}>{body}</p>
    </div>
  );
}

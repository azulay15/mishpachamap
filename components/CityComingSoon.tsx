import { MMHeader } from "./MMHeader";
import { MMIcon } from "@/lib/icons";
import { defaultCity, liveCities, type City } from "@/lib/cities";

/**
 * Teaser shown for a city that's in the registry but whose data files haven't
 * been built yet (`status: "coming-soon"`, or a live city that unexpectedly has
 * no polygons). Keeps the chrome so the URL feels real, and routes the visitor
 * to a city that IS live.
 */
export function CityComingSoon({ city }: { city: City }) {
  const live = liveCities();
  const fallback = live[0] ?? defaultCity();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <MMHeader activeNav="מפה" />
      <main
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "var(--grey-15, #F1F2F4)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 20px",
            }}
          >
            <MMIcon name="pin" size={30} color="var(--pumpkin-orange)" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--grey-900)", margin: "0 0 8px" }}>
            {city.name_he}
          </h1>
          <p style={{ fontSize: 15, color: "var(--grey-500)", lineHeight: 1.6, margin: "0 0 24px" }}>
            אנחנו בונים את מפת השכונות של {city.name_he} — נתוני דמוגרפיה, בתי ספר, ביטחון,
            שטחים ירוקים ותחבורה. חזרו בקרוב.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href={`/map/${fallback.slug}`}
              className="mm-btn mm-btn-primary"
              style={{ textDecoration: "none" }}
            >
              למפה של {fallback.name_he}
            </a>
            <a href="/" className="mm-btn mm-btn-secondary" style={{ textDecoration: "none" }}>
              לכל הערים
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

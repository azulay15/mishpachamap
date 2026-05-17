"use client";

import { useEffect } from "react";
import { MMIcon } from "@/lib/icons";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Props = {
  /** Display title — usually the address or neighborhood name. */
  title: string;
  /** Optional subtitle (neighborhood / city) shown under the title. */
  subtitle?: string;
  /** WGS84 coordinates to drop the pegman. */
  location: { lat: number; lng: number };
  onClose: () => void;
};

/**
 * Google Maps Embed API — Street View mode. Free of per-load fees (the
 * Embed API isn't billed like the Static / JS APIs are), but still
 * requires an API key with the "Maps Embed API" enabled in Google Cloud.
 *
 * Set NEXT_PUBLIC_GOOGLE_MAPS_KEY locally; the modal degrades to a
 * helpful "missing key" message when it's absent so dev mode doesn't
 * silently render a Google "this page didn't load Google Maps correctly"
 * error.
 */
export function StreetViewModal({ title, subtitle, location, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const embedUrl = key
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(key)}` +
      `&location=${location.lat},${location.lng}` +
      `&heading=210&pitch=10&fov=80`
    : null;

  // "Open in Google Maps" — works even without the embed key, opens a
  // proper Street View on maps.google.com.
  const externalUrl =
    `https://www.google.com/maps/@?api=1&map_action=pano` +
    `&viewpoint=${location.lat},${location.lng}` +
    `&heading=210&pitch=10&fov=80`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 70,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`טיול וירטואלי: ${title}`}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        className="mm-modal-content"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(860px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            borderBottom: "1px solid var(--stroke-weak)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <div style={{ fontSize: 11, color: "var(--grey-500)", marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-btn mm-btn-secondary mm-btn-sm"
              style={{ textDecoration: "none" }}
            >
              <MMIcon name="external" size={12} /> פתח ב-Google Maps
            </a>
            <button
              type="button"
              onClick={onClose}
              className="mm-btn mm-btn-ghost mm-btn-sm"
              aria-label="סגור"
              style={{ padding: 6 }}
            >
              <MMIcon name="x" size={16} />
            </button>
          </div>
        </header>

        <div
          style={{
            position: "relative",
            background: "var(--grey-15)",
            aspectRatio: "16 / 10",
            // Cap height so the modal doesn't blow past 100vh on short screens.
            maxHeight: "calc(100vh - 130px)",
          }}
        >
          {embedUrl ? (
            <iframe
              title={`Street View – ${title}`}
              src={embedUrl}
              loading="lazy"
              allow="fullscreen"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          ) : (
            <MissingKey location={location} externalUrl={externalUrl} />
          )}
        </div>

        <footer
          style={{
            padding: "10px 18px 12px",
            borderTop: "1px solid var(--stroke-weak)",
            fontSize: 11,
            color: "var(--grey-500)",
            lineHeight: "16px",
          }}
        >
          תמונות Street View © Google. השתמשו ב-←↑→↓ כדי להסתובב וב-↑↓ לצעוד ברחוב.
        </footer>
      </div>
    </div>
  );
}

function MissingKey({
  location,
  externalUrl,
}: {
  location: { lat: number; lng: number };
  externalUrl: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
        color: "var(--grey-700)",
      }}
    >
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--grey-900)" }}>
          Google Maps API key חסר
        </div>
        <div style={{ fontSize: 12, lineHeight: "18px" }}>
          הוסיפו <code style={{ background: "var(--grey-15)", padding: "1px 4px", borderRadius: 4 }}>
            NEXT_PUBLIC_GOOGLE_MAPS_KEY
          </code> ל-<code style={{ background: "var(--grey-15)", padding: "1px 4px", borderRadius: 4 }}>.env.local</code> כדי להפעיל את ה-Street View המוטמע.
          <br />
          ההטמעה חינמית בתנאי שירות של Google Maps Platform (Embed API).
        </div>
        <div style={{ fontSize: 11, color: "var(--grey-500)" }}>
          נ.ב.: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mm-btn mm-btn-accent mm-btn-sm"
          style={{ textDecoration: "none", alignSelf: "center" }}
        >
          <MMIcon name="external" size={12} color="#fff" /> פתח ב-Google Maps
        </a>
      </div>
    </div>
  );
}

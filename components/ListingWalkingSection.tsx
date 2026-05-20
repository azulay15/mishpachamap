"use client";

import { useEffect, useState } from "react";
import { MMIcon } from "@/lib/icons";
import type { WalkingMetricsPayload } from "@/app/api/listing-walking-metrics/route";

/**
 * Walking accessibility from a specific listing's address. Lazy-fetches the
 * cached metrics from /api/listing-walking-metrics on mount; first open of a
 * listing pays a ~1-2s compute, subsequent opens are instant from the DB cache.
 *
 * Asset-level — distances change per address, not per neighborhood. The
 * companion neighborhood-level approximations are labeled "ממרכז השכונה"
 * elsewhere to keep the two readings honest.
 */
type Props = {
  listingId: string;
};

/** POI types we show, in display order. `celiac` and `community` are present
 *  in the data but skipped here to keep the section compact for V1. */
const POI_DISPLAY: { key: string; he: string; icon: string }[] = [
  { key: "preschool", he: "גן ילדים", icon: "kid" },
  { key: "shop",      he: "סופר",     icon: "cart" },
  { key: "park",      he: "פארק",    icon: "tree" },
  { key: "transit",   he: "תחבורה",  icon: "bus" },
  { key: "celiac",    he: "ללא גלוטן", icon: "gluten" },
];

const WALK_M_PER_MIN = 83; // ~5 km/h average walking speed

function metersToMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

export function ListingWalkingSection({ listingId }: Props) {
  const [data, setData] = useState<WalkingMetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/listing-walking-metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.error ?? `HTTP ${res.status}`);
          return;
        }
        setData(body);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (error) {
    // Don't blow up the whole sheet for a single section failure — show a
    // muted line so we know the section was attempted, then move on.
    return (
      <div className="mm-eyebrow" style={{ padding: "0 20px 12px", color: "var(--grey-500)" }}>
        נתוני נגישות לא זמינים כרגע.
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px 14px" }}>
      <div className="mm-eyebrow" style={{ marginBottom: 8 }}>
        🚶 נגישות מהדירה הזו
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 6,
        }}
      >
        {POI_DISPLAY.map((d) => {
          const near = data?.nearest_pois[d.key];
          return (
            <PoiRow
              key={d.key}
              icon={d.icon}
              label={d.he}
              name={near?.name_he ?? null}
              meters={near?.meters ?? null}
              loading={!data}
            />
          );
        })}
      </div>
    </div>
  );
}

function PoiRow({
  icon,
  label,
  name,
  meters,
  loading,
}: {
  icon: string;
  label: string;
  name: string | null;
  meters: number | null;
  loading: boolean;
}) {
  const empty = !loading && meters == null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 8,
        padding: "8px 10px",
        background: "var(--grey-15)",
        borderRadius: 6,
        alignItems: "center",
        opacity: loading || empty ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "#fff",
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        <MMIcon name={icon} size={13} color="var(--grey-700)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--grey-500)", fontWeight: 600 }}>{label}</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--grey-900)",
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {loading ? "…" : empty ? "אין בטווח" : `${metersToMinutes(meters!)} דק׳ · ${meters}מ׳`}
        </div>
        {!loading && name && (
          <div
            style={{
              fontSize: 10,
              color: "var(--grey-500)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={name}
          >
            {name}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { MMHeader } from "./MMHeader";
import { MMIcon } from "@/lib/icons";
import { useFavorites } from "@/lib/useFavorites";
import { NISshort } from "@/lib/format";

export type SavedNeighborhood = {
  id: string;
  he: string;
  family: string | null;
  summary: string | null;
};

export type SavedListing = {
  id: string;
  neighborhood: string | null;
  address: string;
  price_nis: number;
  rooms: number;
  sqm: number;
  garden_sqm: number | null;
  status_he: string | null;
};

type Props = {
  neighborhoods: SavedNeighborhood[];
  listings: SavedListing[];
};

export function SavedView({ neighborhoods, listings }: Props) {
  const { favs, count, toggleNeighborhood, toggleListing } = useFavorites();

  const savedNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => favs.neighborhoods.includes(n.id)),
    [neighborhoods, favs.neighborhoods],
  );
  const savedListings = useMemo(
    () => listings.filter((l) => favs.listings.includes(l.id)),
    [listings, favs.listings],
  );

  return (
    <div className="mm-shell" style={{ minHeight: "100vh" }}>
      <MMHeader activeNav="" />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ margin: 0 }}>שמורים</h2>
          <span style={{ fontSize: 14, color: "var(--grey-500)" }}>
            {count} פריטים שמורים בדפדפן זה
          </span>
        </header>

        {count === 0 && (
          <div
            className="mm-card"
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--grey-700)",
            }}
          >
            <MMIcon name="heart" size={32} color="var(--grey-500)" />
            <h4 style={{ margin: "12px 0 6px" }}>טרם שמרתם כלום</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--grey-500)" }}>
              לחצו על הלב על כרטיסי שכונות או נכסים כדי לשמור אותם כאן.
            </p>
            <a href="/" className="mm-btn mm-btn-accent" style={{ marginTop: 16, textDecoration: "none" }}>
              חזרה למפה
            </a>
          </div>
        )}

        {savedNeighborhoods.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>
              שכונות ({savedNeighborhoods.length})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {savedNeighborhoods.map((n) => (
                <div key={n.id} className="mm-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{n.he}</h4>
                    {n.family && (
                      <span style={{ fontSize: 11, color: "var(--grey-500)" }}>· {n.family}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleNeighborhood(n.id)}
                      className="mm-btn mm-btn-ghost mm-btn-sm"
                      aria-label="הסר משמורים"
                      style={{ marginInlineStart: "auto", padding: 4, color: "var(--pumpkin-orange)" }}
                    >
                      <MMIcon name="heart-fill" size={14} color="currentColor" />
                    </button>
                  </div>
                  {n.summary && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--grey-700)", lineHeight: "18px" }}>
                      {n.summary}
                    </p>
                  )}
                  <a
                    href={`/?n=${n.id}`}
                    className="mm-btn mm-btn-secondary mm-btn-sm"
                    style={{ marginTop: 10, textDecoration: "none" }}
                  >
                    הצג במפה
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {savedListings.length > 0 && (
          <section>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>
              נכסים ({savedListings.length})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {savedListings.map((l) => (
                <div key={l.id} className="mm-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        fontFamily: "var(--font-inter, Inter)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {NISshort(l.price_nis)}
                    </div>
                    {l.status_he && (
                      <span className="mm-tag mm-tag-new" style={{ fontSize: 9 }}>
                        {l.status_he}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleListing(l.id)}
                      className="mm-btn mm-btn-ghost mm-btn-sm"
                      aria-label="הסר נכס משמורים"
                      style={{ marginInlineStart: "auto", padding: 4, color: "var(--pumpkin-orange)" }}
                    >
                      <MMIcon name="heart-fill" size={14} color="currentColor" />
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--grey-700)", marginBottom: 6 }}>{l.address}</div>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--grey-500)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <MMIcon name="bed" size={12} color="#84888E" /> {l.rooms} חד׳
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <MMIcon name="ruler" size={12} color="#84888E" /> {l.sqm} מ"ר
                    </span>
                    {l.garden_sqm != null && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <MMIcon name="garden" size={12} color="#84888E" /> {l.garden_sqm} גינה
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

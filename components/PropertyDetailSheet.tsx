"use client";

import { useEffect, useState } from "react";
import { MMIcon } from "@/lib/icons";
import { NIS, NISshort } from "@/lib/format";
import { MatchBadge } from "./MatchBadge";
import { useFavorites } from "@/lib/useFavorites";
import type { ListingRow } from "./ListingsPanel";
import { LeadGenModal, type LeadKind } from "./LeadGenModal";
import { StreetViewModal } from "./StreetViewModal";
import { externalSearchUrls } from "@/lib/externalLinks";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Props = {
  listing: ListingRow;
  /** Hebrew name of the neighborhood the listing belongs to. */
  neighborhoodHe: string;
  /** WGS84 coordinates used to drop the Street View pegman. Listings without
   *  their own geocoded point fall back to the neighborhood center. */
  location: { lat: number; lng: number } | null;
  onClose: () => void;
  /** Optional — open the match breakdown for this listing's neighborhood. */
  onExplainMatch?: () => void;
};

export function PropertyDetailSheet({ listing, neighborhoodHe, location, onClose, onExplainMatch }: Props) {
  const { hasListing, toggleListing } = useFavorites();
  const isFav = hasListing(listing.id);
  const [leadOpen, setLeadOpen] = useState<LeadKind | null>(null);
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`פרטי הנכס: ${listing.address}`}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        className="mm-scroll mm-modal-content"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(640px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Hero — placeholder gradient until real photos are wired. */}
        <div
          style={{
            position: "relative",
            aspectRatio: "16 / 9",
            background:
              "linear-gradient(135deg, #C8B294 0%, #94734F 60%, #5C4626 100%)",
          }}
        >
          <svg
            viewBox="0 0 200 120"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}
          >
            <rect x="20" y="60" width="40" height="60" fill="#fff" opacity="0.3" />
            <rect x="70" y="40" width="50" height="80" fill="#fff" opacity="0.4" />
            <rect x="130" y="55" width="50" height="65" fill="#fff" opacity="0.35" />
          </svg>
          <div style={{ position: "absolute", top: 14, insetInlineStart: 14, display: "flex", gap: 6 }}>
            {listing.status_he && (
              <span className="mm-tag mm-tag-new">{listing.status_he}</span>
            )}
            <span
              className="mm-tag mm-tag-soft"
              style={{ background: "rgba(255,255,255,0.92)", color: "#181C21" }}
            >
              {listing.days_on_market ?? "?"} ימים בשוק
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggleListing(listing.id)}
            aria-label={isFav ? "הסר נכס משמורים" : "שמור נכס"}
            style={{
              position: "absolute",
              top: 14,
              insetInlineEnd: 14,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: 0,
              background: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: isFav ? "var(--pumpkin-orange)" : "var(--grey-700)",
            }}
          >
            <MMIcon name={isFav ? "heart-fill" : "heart"} size={18} color="currentColor" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            style={{
              position: "absolute",
              bottom: 14,
              insetInlineEnd: 14,
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: 0,
              background: "rgba(24,28,33,0.85)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#fff",
            }}
          >
            <MMIcon name="x" size={16} color="currentColor" />
          </button>
        </div>

        {/* Header */}
        <header
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--stroke-weak)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                fontFamily: "var(--font-inter, Inter)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: "32px",
              }}
            >
              {NIS(listing.price_nis)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{listing.address}</div>
            <div style={{ fontSize: 12, color: "var(--grey-500)" }}>{neighborhoodHe}</div>
          </div>
          <MatchBadge score={listing.matchScore} onClick={onExplainMatch} />
        </header>

        {/* Stats grid */}
        <div
          style={{
            padding: "14px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
          }}
        >
          <Stat icon="bed" label="חדרים" value={`${listing.rooms}`} />
          <Stat icon="ruler" label='מ"ר' value={`${listing.sqm}`} />
          <Stat
            icon="garden"
            label="גינה"
            value={listing.garden_sqm != null ? `${listing.garden_sqm} מ"ר` : "אין"}
          />
          <Stat icon="tag" label='מחיר/מ"ר' value={NISshort(Math.round(listing.price_nis / listing.sqm))} />
        </div>

        {/* External search link-outs — until we have real Yad2/Madlan/Nadlan ingest,
            user can open a pre-filled search on each source site. */}
        <div
          style={{
            padding: "0 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            className="mm-eyebrow"
            style={{ marginBottom: 4 }}
          >
            ראו את הנכס במקורות חיים
          </div>
          <ExternalSearchRow address={listing.address} />
        </div>

        {/* Virtual walk — Google Street View embed of the listing's
            neighborhood. Hidden if we couldn't resolve coordinates. */}
        {location && (
          <div style={{ padding: "0 20px 12px" }}>
            <button
              type="button"
              onClick={() => setStreetViewOpen(true)}
              className="mm-btn mm-btn-secondary"
              style={{ width: "100%" }}
            >
              <MMIcon name="directions" size={14} /> טיול וירטואלי ברחוב (Street View)
            </button>
          </div>
        )}

        {/* Lead-gen CTAs */}
        <div
          style={{
            padding: "0 20px 18px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <button
            type="button"
            className="mm-btn mm-btn-accent"
            onClick={() => setLeadOpen("mortgage")}
          >
            <MMIcon name="zap" size={14} color="#fff" /> קבלו אישור עקרוני
          </button>
          <button
            type="button"
            className="mm-btn mm-btn-secondary"
            onClick={() => setLeadOpen("inspection")}
          >
            <MMIcon name="shield" size={14} /> הזמינו בדק בית
          </button>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--stroke-weak)",
            fontSize: 11,
            color: "var(--grey-500)",
            lineHeight: "16px",
          }}
        >
          נכס מסונתז ל-V1 (תג <code>synthetic-v1</code>). הנתונים החיים — מחירים, תמונות, סטטוס — נמצאים באתרים המקוריים שלמעלה.
        </footer>
      </div>

      {leadOpen && (
        <LeadGenModal
          kind={leadOpen}
          context={{
            listingId: listing.id,
            neighborhoodId: neighborhoodHe,
            address: listing.address,
          }}
          onClose={() => setLeadOpen(null)}
        />
      )}

      {streetViewOpen && location && (
        <StreetViewModal
          title={listing.address || neighborhoodHe}
          subtitle={listing.address ? neighborhoodHe : undefined}
          location={location}
          onClose={() => setStreetViewOpen(false)}
        />
      )}
    </div>
  );
}

function ExternalSearchRow({ address }: { address: string }) {
  const urls = externalSearchUrls(address);
  const items = [
    { href: urls.yad2, label: "Yad2", color: "#FFC63C" },
    { href: urls.madlan, label: "Madlan", color: "#1256A0" },
    { href: urls.nadlan, label: "נדל\"ן.gov", color: "#5B9F40" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mm-btn mm-btn-secondary mm-btn-sm"
          style={{
            textDecoration: "none",
            justifyContent: "space-between",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: i.color,
                flex: "none",
              }}
            />
            {i.label}
          </span>
          <MMIcon name="external" size={12} color="var(--grey-500)" />
        </a>
      ))}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
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
            fontSize: 14,
            fontWeight: 800,
            color: "var(--grey-900)",
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

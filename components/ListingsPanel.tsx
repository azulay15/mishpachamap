"use client";

import { useState } from "react";
import { MMIcon } from "@/lib/icons";
import { ScoreChip } from "./ScoreChip";
import { MatchBadge } from "./MatchBadge";
import { PropertyDetailSheet } from "./PropertyDetailSheet";
import { LeadGenModal, type LeadKind } from "./LeadGenModal";
import { NIS, NISshort, pct } from "@/lib/format";
import { useFavorites } from "@/lib/useFavorites";
import { externalSearchUrls } from "@/lib/externalLinks";

export type ListingRow = {
  id: string;
  address: string;
  price_nis: number;
  price_per_m2: number;
  rooms: number;
  sqm: number;
  garden_sqm: number | null;
  status_he: string | null;
  days_on_market: number | null;
  matchScore: number;
};

export type SchoolRow = {
  id: string;
  name_he: string;
  meitzav_score: number | null;
  walkMinutes: number | null;
};

export type Selected = {
  id: string;
  he: string;
  family: string | null;
  summary: string | null;
  matchScore: number;
  avgPrice: number;
  avgPriceDelta: number;
  avgListing: number;
  greenScore: number;
  schoolScore: number;
};

type Props = {
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  onExplainMatch?: () => void;
};

export function ListingsPanel({ selected, listings, schools, onExplainMatch }: Props) {
  const [openListing, setOpenListing] = useState<ListingRow | null>(null);
  const [leadOpen, setLeadOpen] = useState<LeadKind | null>(null);

  if (!selected) {
    return (
      <aside style={asideStyle}>
        <div style={{ padding: 24, color: "var(--grey-500)", fontSize: 13 }}>
          בחרו שכונה במפה כדי לראות נכסים פעילים, בתי ספר במרחק הליכה ופרטי התאמה.
        </div>
      </aside>
    );
  }

  return (
    <aside style={asideStyle}>
      <header
        style={{
          padding: 16,
          borderBottom: "1px solid var(--stroke-weak)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selected.he}</h3>
              <MatchBadge score={selected.matchScore} onClick={onExplainMatch} />
            </div>
            {selected.family && (
              <div style={{ marginTop: 2, fontSize: 12, color: "var(--grey-500)" }}>
                {selected.family}
              </div>
            )}
          </div>
          <button className="mm-btn mm-btn-ghost mm-btn-sm" aria-label="פעולות נוספות">
            <MMIcon name="more" size={16} />
          </button>
        </div>
        {selected.summary && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--grey-700)", lineHeight: "18px" }}>
            {selected.summary}
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <Stat label="חציון" value={NISshort(selected.avgListing)} />
          <Stat
            label='מחיר/מ"ר'
            value={
              <>
                {NIS(selected.avgPrice)}{" "}
                <span className={selected.avgPriceDelta > 0 ? "mm-up" : "mm-down"} style={{ fontSize: 11 }}>
                  {pct(selected.avgPriceDelta)}
                </span>
              </>
            }
          />
          <Stat
            label="GreenScore"
            value={<span style={{ color: "var(--green-positive)" }}>{selected.greenScore}</span>}
          />
        </div>
      </header>

      <div className="mm-scroll" style={{ overflow: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Section title="נכסים פעילים">
          {listings.length === 0 ? (
            <Empty>אין כרגע נכסים פעילים בשכונה זו.</Empty>
          ) : (
            listings.slice(0, 3).map((l) => (
            <ListingRowCard
              key={l.id}
              listing={l}
              onExplainMatch={onExplainMatch}
              onOpen={() => setOpenListing(l)}
            />
          ))
          )}
          {/* Neighborhood-level external search — see every listing on the live sites. */}
          <NeighborhoodExternalSearch neighborhoodHe={selected.he} />
        </Section>

        <Section title="בתי ספר במרחק הליכה">
          {schools.length === 0 ? (
            <Empty>אין נתוני בתי ספר עדיין.</Empty>
          ) : (
            schools.slice(0, 3).map((s) => <SchoolRowCard key={s.id} school={s} />)
          )}
        </Section>
      </div>

      <footer
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--stroke-weak)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <button
          type="button"
          className="mm-btn mm-btn-accent"
          onClick={() => setLeadOpen("mortgage")}
        >
          <MMIcon name="zap" size={14} color="#fff" /> קבלו אישור עקרוני למשכנתא
        </button>
        <button
          type="button"
          className="mm-btn mm-btn-secondary mm-btn-sm"
          onClick={() => setLeadOpen("inspection")}
        >
          <MMIcon name="shield" size={14} /> הזמינו בדק בית
        </button>
      </footer>

      {leadOpen && (
        <LeadGenModal
          kind={leadOpen}
          context={{ neighborhoodId: selected.id, address: selected.he }}
          onClose={() => setLeadOpen(null)}
        />
      )}

      {openListing && (
        <PropertyDetailSheet
          listing={openListing}
          neighborhoodHe={selected.he}
          onClose={() => setOpenListing(null)}
          onExplainMatch={onExplainMatch}
        />
      )}
    </aside>
  );
}

const asideStyle: React.CSSProperties = {
  background: "#fff",
  borderInlineStart: "1px solid var(--stroke-weak)",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  overflow: "hidden",
  height: "100%",
  minHeight: 0,
};

function NeighborhoodExternalSearch({ neighborhoodHe }: { neighborhoodHe: string }) {
  const urls = externalSearchUrls(neighborhoodHe);
  const items = [
    { href: urls.yad2, label: "Yad2", color: "#FFC63C" },
    { href: urls.madlan, label: "Madlan", color: "#1256A0" },
    { href: urls.nadlan, label: 'נדל"ן.gov', color: "#5B9F40" },
  ];
  return (
    <div
      style={{
        marginTop: 4,
        padding: "10px 12px",
        background: "var(--grey-15)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--grey-700)", fontWeight: 600 }}>
        כל הנכסים הפעילים בשכונה — באתרי המקור:
      </div>
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
              gap: 4,
              fontSize: 11,
              height: 28,
              padding: "0 8px",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: i.color,
                  flex: "none",
                }}
              />
              {i.label}
            </span>
            <MMIcon name="external" size={10} color="var(--grey-500)" />
          </a>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mm-eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--grey-500)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-inter, Inter)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mm-card" style={{ padding: 12, fontSize: 12, color: "var(--grey-500)" }}>
      {children}
    </div>
  );
}

function ListingRowCard({
  listing,
  onExplainMatch,
  onOpen,
}: {
  listing: ListingRow;
  onExplainMatch?: () => void;
  onOpen?: () => void;
}) {
  const { hasListing, toggleListing } = useFavorites();
  const isFav = hasListing(listing.id);
  return (
    <div
      className="mm-card mm-card-hover"
      onClick={onOpen}
      style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 8, cursor: "pointer" }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <button
            type="button"
            aria-label={isFav ? "הסר נכס משמורים" : "שמור נכס"}
            onClick={(e) => {
              e.stopPropagation();
              toggleListing(listing.id);
            }}
            style={{
              flex: "none",
              border: 0,
              background: "transparent",
              padding: 2,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: isFav ? "var(--pumpkin-orange)" : "var(--grey-500)",
            }}
          >
            <MMIcon name={isFav ? "heart-fill" : "heart"} size={13} color="currentColor" />
          </button>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-inter, Inter)", fontVariantNumeric: "tabular-nums" }}>
            {NISshort(listing.price_nis)}
          </div>
          {listing.status_he && (
            <span className="mm-tag mm-tag-new" style={{ fontSize: 9 }}>
              {listing.status_he}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--grey-700)", marginBottom: 4 }}>{listing.address}</div>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--grey-500)" }}>
          <Inline icon="bed" text={`${listing.rooms} חד׳`} />
          <Inline icon="ruler" text={`${listing.sqm} מ"ר`} />
          {listing.garden_sqm != null && <Inline icon="garden" text={`${listing.garden_sqm} גינה`} />}
        </div>
      </div>
      <MatchBadge score={listing.matchScore} onClick={onExplainMatch} />
    </div>
  );
}

function SchoolRowCard({ school }: { school: SchoolRow }) {
  return (
    <div className="mm-card" style={{ padding: 10, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
      <ScoreChip
        value={school.meitzav_score ? Math.round(school.meitzav_score * 10) : 0}
        color="var(--layer-school)"
        size="sm"
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{school.name_he}</div>
        {school.walkMinutes != null && (
          <div style={{ fontSize: 11, color: "var(--grey-500)" }}>{school.walkMinutes} דק׳ הליכה</div>
        )}
      </div>
      <button className="mm-btn mm-btn-ghost mm-btn-sm" aria-label="פתח במפה">
        <MMIcon name="pin" size={14} />
      </button>
    </div>
  );
}

function Inline({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <MMIcon name={icon} size={12} color="#84888E" />
      {text}
    </span>
  );
}

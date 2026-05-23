"use client";

import { useEffect } from "react";
import { MMIcon } from "@/lib/icons";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { RightRail, type RailMode } from "./RightRail";
import { type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { type NeighborhoodElection } from "./ElectionsPanel";

/**
 * Modal wrapper around the existing RightRail (Listings + AI tabs) for use
 * with the new persistent NeighborhoodListRail layout. Opens when the user
 * clicks "פתח פרטים" on a selected neighborhood card.
 */
type Props = {
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  election: NeighborhoodElection | null;
  mode: RailMode;
  onModeChange: (m: RailMode) => void;
  onExplainMatch?: () => void;
  onClose: () => void;
};

export function NeighborhoodDetailsSheet({
  selected,
  listings,
  schools,
  election,
  mode,
  onModeChange,
  onExplainMatch,
  onClose,
}: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!selected) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 55,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`פרטים על ${selected.he}`}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        className="mm-modal-content"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(480px, 100%)",
          height: "min(720px, calc(100vh - 48px))",
          overflow: "hidden",
          boxShadow: "var(--shadow-xl)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "8px 12px",
            borderBottom: "1px solid var(--stroke-weak)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="mm-btn mm-btn-ghost mm-btn-sm"
            aria-label="סגור פרטי שכונה"
            style={{ padding: 6 }}
          >
            <MMIcon name="x" size={16} />
          </button>
        </div>
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <RightRail
            selected={selected}
            listings={listings}
            schools={schools}
            election={election}
            mode={mode}
            onModeChange={onModeChange}
            onExplainMatch={onExplainMatch}
          />
        </div>
      </div>
    </div>
  );
}

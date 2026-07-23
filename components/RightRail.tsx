"use client";

import { ListingsPanel, type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { AIRail } from "./AIRail";
import { MMIcon } from "@/lib/icons";
import { type NeighborhoodElection } from "./ElectionsPanel";

export type RailMode = "listings" | "ai";

type Props = {
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  election: NeighborhoodElection | null;
  mode: RailMode;
  onModeChange: (m: RailMode) => void;
  onExplainMatch?: () => void;
};

export function RightRail({ selected, listings, schools, election, mode, onModeChange, onExplainMatch }: Props) {

  return (
    <aside
      style={{
        background: "#fff",
        borderInlineStart: "1px solid var(--stroke-weak)",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--stroke-weak)",
          display: "flex",
          gap: 4,
          // Segmented-control track, so the active tab reads as a raised pill.
          background: "transparent",
        }}
      >
        <RailTab
          icon="home"
          label="נכסים פעילים"
          active={mode === "listings"}
          onClick={() => onModeChange("listings")}
        />
        <RailTab
          icon="sparkle"
          label="מומחה השכונה"
          active={mode === "ai"}
          onClick={() => onModeChange("ai")}
          accent
        />
      </div>
      <div style={{ minHeight: 0, overflow: "hidden" }}>
        {mode === "listings" ? (
          <ListingsPanel
            selected={selected}
            listings={listings}
            schools={schools}
            election={election}
            onExplainMatch={onExplainMatch}
          />
        ) : (
          <AIRail selectedNeighborhoodHe={selected?.he ?? null} />
        )}
      </div>
    </aside>
  );
}

function RailTab({
  icon,
  label,
  active,
  onClick,
  accent = false,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        height: 34,
        borderRadius: 8,
        // Dark pill for the AI tab (it is the "special" one); a raised white
        // pill for the listings tab. Previously the active listings tab was
        // white text on --grey-15 — invisible.
        border: active && !accent ? "1px solid var(--stroke-medium)" : "1px solid transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: 800,
        background: active ? (accent ? "var(--grey-900)" : "#fff") : "transparent",
        color: active ? (accent ? "#fff" : "var(--grey-900)") : "var(--grey-700)",
        boxShadow: active && !accent ? "var(--shadow-sm)" : "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "background 140ms, color 140ms, box-shadow 140ms",
      }}
    >
      <MMIcon
        name={icon}
        size={14}
        color={
          active
            ? accent
              ? "var(--pumpkin-orange)"
              : "var(--pumpkin-orange)"
            : "var(--grey-500)"
        }
      />
      {label}
    </button>
  );
}

"use client";

import { ListingsPanel, type ListingRow, type SchoolRow, type Selected } from "./ListingsPanel";
import { AIRail } from "./AIRail";
import { MMIcon } from "@/lib/icons";

export type RailMode = "listings" | "ai";

type Props = {
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  mode: RailMode;
  onModeChange: (m: RailMode) => void;
  onExplainMatch?: () => void;
};

export function RightRail({ selected, listings, schools, mode, onModeChange, onExplainMatch }: Props) {

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
          gap: 6,
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
        height: 32,
        borderRadius: 6,
        border: 0,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 700,
        background: active ? (accent ? "var(--grey-900)" : "var(--grey-15)") : "transparent",
        color: active ? "#fff" : "var(--grey-700)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "background 120ms",
      }}
    >
      <MMIcon
        name={icon}
        size={13}
        color={active ? (accent ? "var(--pumpkin-orange)" : "var(--grey-700)") : "var(--grey-700)"}
      />
      {label}
    </button>
  );
}

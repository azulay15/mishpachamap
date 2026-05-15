"use client";

import { useEffect } from "react";
import { RightRail, type RailMode } from "./RightRail";
import type { ListingRow, SchoolRow, Selected } from "./ListingsPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  mode: RailMode;
  onModeChange: (m: RailMode) => void;
  onExplainMatch?: () => void;
};

/** Bottom drawer that wraps RightRail for narrow viewports. Slides up from
 *  the bottom, takes 85vh. Tap backdrop or press Escape to close. */
export function MobileRailDrawer({
  open,
  onClose,
  selected,
  listings,
  schools,
  mode,
  onModeChange,
  onExplainMatch,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="mm-drawer-backdrop" onClick={onClose} />
      <div className="mm-drawer" role="dialog" aria-modal="true">
        <div className="mm-drawer-handle" />
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <RightRail
            selected={selected}
            listings={listings}
            schools={schools}
            mode={mode}
            onModeChange={onModeChange}
            onExplainMatch={onExplainMatch}
          />
        </div>
      </div>
    </>
  );
}

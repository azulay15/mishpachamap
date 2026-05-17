"use client";

import { useEffect, useRef, useState } from "react";
import { RightRail, type RailMode } from "./RightRail";
import type { ListingRow, SchoolRow, Selected } from "./ListingsPanel";
import type { NeighborhoodElection } from "./ElectionsPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  selected: Selected | null;
  listings: ListingRow[];
  schools: SchoolRow[];
  election: NeighborhoodElection | null;
  mode: RailMode;
  onModeChange: (m: RailMode) => void;
  onExplainMatch?: () => void;
};

/** Bottom drawer that wraps RightRail for narrow viewports. Slides up from
 *  the bottom, takes 85vh. Tap backdrop, press Escape, or drag the handle
 *  down past the threshold to close. */
export function MobileRailDrawer({
  open,
  onClose,
  selected,
  listings,
  schools,
  election,
  mode,
  onModeChange,
  onExplainMatch,
}: Props) {
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset transient drag state whenever the drawer mounts.
  useEffect(() => {
    if (open) {
      setDragY(null);
      dragStartRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { y: e.clientY, t: performance.now() };
    setDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    // Only allow downward drag; clamp small upward drag to 0 with rubber-band.
    setDragY(dy > 0 ? dy : dy * 0.15);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    const dt = Math.max(1, performance.now() - dragStartRef.current.t);
    const velocity = dy / dt; // px per ms
    dragStartRef.current = null;
    // Close on either distance threshold OR a fast downward flick.
    if (dy > 120 || velocity > 0.6) {
      onClose();
      return;
    }
    setDragY(null); // spring back via CSS transition
  };

  // While actively dragging we suppress the spring transition; on release
  // (dragY === null) the transition takes over and snaps back to 0.
  const transform = dragY != null ? `translateY(${Math.max(0, dragY)}px)` : undefined;
  const transition = dragY != null ? "none" : "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <>
      <div className="mm-drawer-backdrop" onClick={onClose} />
      <div
        className="mm-drawer"
        role="dialog"
        aria-modal="true"
        style={{ transform, transition }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          role="button"
          aria-label="גררו כדי לסגור"
          tabIndex={0}
          style={{
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            display: "flex",
            justifyContent: "center",
            flex: "none",
            // Larger hit area than the visible handle for thumb-friendly drag.
            padding: "4px 0 8px",
          }}
        >
          <div className="mm-drawer-handle" style={{ margin: "4px 0 0" }} />
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
    </>
  );
}

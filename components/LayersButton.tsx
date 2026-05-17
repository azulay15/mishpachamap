"use client";

import { useEffect, useRef, useState } from "react";
import { LAYERS, type Layer, type LayerId } from "@/lib/layers";
import { MMIcon } from "@/lib/icons";

type Props = {
  active: Set<LayerId>;
  onToggle: (id: LayerId) => void;
};

/** Single button replacing the horizontal chip row. Shows the active count
 *  and a stack of color dots for the active layers; opens a popover with
 *  every layer as a toggle. */
export function LayersButton({ active, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeLayers = LAYERS.filter((l) => active.has(l.id));

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`שכבות מפה (${active.size} פעילות)`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 14px 0 12px",
          background: "#fff",
          borderRadius: 999,
          boxShadow: "var(--shadow-md)",
          border: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--grey-900)",
        }}
      >
        <MMIcon name="layers" size={16} color="var(--grey-700)" />
        <span>שכבות</span>
        {/* Color-dot stack — small at-a-glance hint of what's on. */}
        {activeLayers.length > 0 && (
          <span
            aria-hidden
            style={{ display: "inline-flex", alignItems: "center", gap: 2, marginInlineStart: 2 }}
          >
            {activeLayers.slice(0, 4).map((l) => (
              <span
                key={l.id}
                style={{ width: 8, height: 8, borderRadius: 999, background: l.color }}
              />
            ))}
          </span>
        )}
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: active.size > 0 ? "var(--grey-900)" : "var(--grey-15)",
            color: active.size > 0 ? "#fff" : "var(--grey-500)",
            fontSize: 11,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-inter, Inter)",
            fontVariantNumeric: "tabular-nums",
            marginInlineStart: 2,
          }}
        >
          {active.size}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="שכבות מפה"
          style={{
            position: "absolute",
            top: 48,
            insetInlineStart: 0,
            zIndex: 6,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            padding: 8,
            width: 240,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {LAYERS.map((l) => (
            <LayerRow key={l.id} layer={l} on={active.has(l.id)} onToggle={() => onToggle(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function LayerRow({ layer, on, onToggle }: { layer: Layer; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        border: 0,
        background: on ? "var(--grey-15)" : "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "start",
        width: "100%",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: on ? layer.color : "var(--grey-15)",
          color: on ? "#fff" : "var(--grey-500)",
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        <MMIcon name={layer.icon} size={12} color="currentColor" />
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 700 : 600, color: "var(--grey-900)" }}>
        {layer.he}
      </span>
      <span
        aria-hidden
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: on ? layer.color : "var(--grey-100)",
          position: "relative",
          flex: "none",
          transition: "background 120ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            insetInlineStart: on ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
            transition: "inset-inline-start 120ms",
          }}
        />
      </span>
    </button>
  );
}

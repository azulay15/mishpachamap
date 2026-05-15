"use client";

import { MMIcon } from "@/lib/icons";
import type { Layer } from "@/lib/layers";

type Props = {
  layer: Layer;
  on: boolean;
  onClick: () => void;
  size?: "sm" | "md";
};

export function LayerChip({ layer, on, onClick, size = "md" }: Props) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`mm-chip ${on ? "mm-chip-on" : ""}`}
      style={{
        height: sm ? 26 : 30,
        padding: sm ? "0 8px" : "0 12px",
        fontSize: sm ? 11 : 12,
      }}
      title={layer.he}
    >
      <span
        className="mm-dot"
        style={{
          background: layer.color,
          opacity: on ? 1 : 0.7,
          width: sm ? 6 : 8,
          height: sm ? 6 : 8,
        }}
      />
      <MMIcon name={layer.icon} size={sm ? 12 : 14} color={on ? "#fff" : "var(--grey-700)"} />
      {layer.he}
    </button>
  );
}

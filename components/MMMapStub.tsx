"use client";

/**
 * Pure-SVG fallback map for local preview without a Mapbox token.
 * Ported from `Pick a neighborhood/design_handoff_concierge_map/shared/map.jsx`.
 * Coordinate space: 1600 wide × 1000 tall (handoff's stylized Modi'in layout).
 */
import { useState } from "react";
import type { LayerId } from "@/lib/layers";
import { LAYERS } from "@/lib/layers";
import type { ConciergeData } from "./ConciergeScreen";

type Props = {
  neighborhoods: ConciergeData["neighborhoods"];
  pois: ConciergeData["pois"];
  activeLayers: Set<LayerId>;
  selected: string | null;
  hover: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
};

export function MMMapStub({
  neighborhoods,
  pois,
  activeLayers,
  selected,
  hover,
  onSelect,
  onHover,
}: Props) {
  const [focusedPoi, setFocusedPoi] = useState<string | null>(null);

  const layerById = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<LayerId, (typeof LAYERS)[number]>;

  const tintFor = (n: ConciergeData["neighborhoods"][number]): string => {
    if (activeLayers.has("greenscore")) {
      return `rgba(47,143,79,${0.10 + (n.greenScore - 70) * 0.025})`;
    }
    if (activeLayers.has("price")) {
      const norm = Math.min(1, Math.max(0, (n.avgPrice - 26000) / 9000));
      return `rgba(255,107,0,${0.08 + norm * 0.32})`;
    }
    const norm = Math.min(1, Math.max(0, (n.matchScore - 70) / 25));
    return `rgba(255,107,0,${0.10 + norm * 0.30})`;
  };

  return (
    <div className="mm-map-canvas" style={{ position: "absolute", inset: 0 }}>
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block", width: "100%", height: "100%" }}
        onClick={(e) => {
          // Click on bare svg = deselect
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {/* Parks (open green areas) */}
        <g opacity="0.95">
          <path
            d="M 880,170 C 1020,150 1180,160 1280,200 L 1260,280 C 1140,260 1020,260 920,280 Z"
            fill="var(--map-park-fill)"
          />
          <path
            d="M 220,560 C 320,520 440,520 540,560 L 520,640 C 420,620 320,620 240,640 Z"
            fill="var(--map-park-fill)"
          />
          <circle cx="1240" cy="470" r="80" fill="var(--map-park-fill)" />
          <circle cx="950" cy="320" r="70" fill="var(--map-park-fill)" />
          <circle cx="690" cy="470" r="55" fill="var(--map-park-fill)" />
          <circle cx="1180" cy="770" r="90" fill="var(--map-park-fill)" />
          <circle cx="840" cy="540" r="42" fill="var(--map-park-fill)" />
          <circle cx="560" cy="620" r="50" fill="var(--map-park-fill)" />
        </g>

        {/* Built-up neighborhood backgrounds */}
        <g opacity="0.6">
          {neighborhoods.map((n) =>
            n.svgPath ? <path key={n.id} d={n.svgPath} fill="var(--map-built)" /> : null,
          )}
        </g>

        {/* Highway 443 */}
        <g>
          <path
            d="M 80,180 C 280,260 480,300 700,290 C 920,280 1140,300 1340,260 L 1560,210"
            fill="none"
            stroke="var(--map-road-stroke)"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M 80,180 C 280,260 480,300 700,290 C 920,280 1140,300 1340,260 L 1560,210"
            fill="none"
            stroke="var(--map-road-hwy)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <g transform="translate(680,250)">
            <rect x="-14" y="-10" width="28" height="20" rx="3" fill="var(--grey-900)" />
            <text className="mm-map-label-hwy" x="0" y="4" textAnchor="middle">443</text>
          </g>
        </g>

        {/* Highway 6 */}
        <g opacity="0.85">
          <path
            d="M 200,80 L 220,360 L 240,640 L 260,940"
            fill="none"
            stroke="var(--map-road-stroke)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M 200,80 L 220,360 L 240,640 L 260,940"
            fill="none"
            stroke="var(--map-road-hwy)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <g transform="translate(238,500)">
            <rect x="-11" y="-9" width="22" height="18" rx="3" fill="var(--grey-900)" />
            <text className="mm-map-label-hwy" x="0" y="4" textAnchor="middle">6</text>
          </g>
        </g>

        {/* Local arteries */}
        <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
          <path d="M 600,160 C 700,250 750,340 800,420 C 870,520 920,600 950,720 L 980,920" />
          <path d="M 1340,180 C 1280,300 1240,420 1240,540 C 1240,660 1200,780 1140,900" />
          <path d="M 320,420 C 480,440 640,460 800,440 C 960,420 1120,440 1280,420 C 1380,410 1440,420 1500,440" />
          <path d="M 280,720 C 440,720 600,720 760,720 C 920,720 1080,720 1240,720 C 1340,720 1400,720 1480,720" />
        </g>

        {/* Heatmap tint per neighborhood */}
        <g>
          {neighborhoods.map((n) =>
            n.svgPath ? <path key={n.id} d={n.svgPath} fill={tintFor(n)} /> : null,
          )}
        </g>

        {/* Hover/selected stroke + click target */}
        <g fill="none">
          {neighborhoods.map((n) => {
            if (!n.svgPath) return null;
            const isSel = selected === n.id;
            const isHov = hover === n.id;
            return (
              <path
                key={n.id}
                d={n.svgPath}
                stroke={isSel ? "var(--pumpkin-orange)" : isHov ? "var(--grey-900)" : "transparent"}
                strokeWidth={isSel ? 4 : 2.5}
                strokeDasharray={isSel ? "8 4" : "0"}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                fill={isHov && !isSel ? "rgba(255,107,0,0.05)" : "rgba(0,0,0,0)"}
                onMouseEnter={() => onHover(n.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(n.id)}
              />
            );
          })}
        </g>

        {/* POI markers */}
        <g>
          {pois.map((p) => {
            const type = p.properties.type as LayerId;
            if (!activeLayers.has(type)) return null;
            const layer = layerById[type];
            if (!layer) return null;
            const pos = p.properties.svgPos;
            if (!pos) return null;
            const focused = focusedPoi === p.properties.id;
            const r = focused ? 11 : 7;
            return (
              <g
                key={p.properties.id}
                transform={`translate(${pos[0]},${pos[1]})`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusedPoi(focused ? null : p.properties.id);
                }}
              >
                <circle r={r + 4} fill="#fff" opacity={focused ? 0.9 : 0.7} />
                <circle r={r} fill={layer.color} stroke="#fff" strokeWidth={1.5} />
                {focused && p.properties.name_he && (
                  <g>
                    <rect
                      x={r + 8}
                      y={-12}
                      rx={4}
                      width={p.properties.name_he.length * 7 + 18}
                      height={24}
                      fill="var(--grey-900)"
                    />
                    <text x={r + 16} y={4} fill="#fff" style={{ fontSize: 11, fontWeight: 700 }}>
                      {p.properties.name_he}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Neighborhood labels */}
        {neighborhoods.map((n) =>
          n.svgCenter ? (
            <text
              key={n.id}
              className="mm-map-label mm-map-label-lg"
              x={n.svgCenter[0]}
              y={n.svgCenter[1]}
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              {n.he}
            </text>
          ) : null,
        )}

        {/* City label */}
        <text
          className="mm-map-label mm-map-label-lg"
          x={800}
          y={100}
          textAnchor="middle"
          style={{ fontSize: 22, opacity: 0.7, pointerEvents: "none" }}
        >
          מודיעין-מכבים-רעות
        </text>

        {/* Selected neighborhood callout */}
        {selected && (() => {
          const n = neighborhoods.find((x) => x.id === selected);
          if (!n || !n.svgCenter) return null;
          return (
            <g
              transform={`translate(${n.svgCenter[0]},${n.svgCenter[1] - 50})`}
              style={{ pointerEvents: "none" }}
            >
              <rect x={-100} y={-30} width={200} height={44} rx={8} fill="var(--grey-900)" />
              <text x={0} y={-12} textAnchor="middle" fill="#fff" style={{ fontSize: 13, fontWeight: 700 }}>
                {n.he}
              </text>
              <text
                x={0}
                y={6}
                textAnchor="middle"
                fill="#FF6B00"
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                התאמה {n.matchScore}/100 · ₪{(n.avgListing / 1_000_000).toFixed(2)}M ממוצע
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Preview-mode indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          insetInlineStart: 14,
          background: "rgba(24,28,33,0.9)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 10px",
          borderRadius: 999,
          pointerEvents: "none",
        }}
      >
        תצוגה מקדימה · ללא Mapbox
      </div>
    </div>
  );
}

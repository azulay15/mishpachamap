"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";

export type SearchableNeighborhood = {
  id: string;
  he: string;
  family: string | null;
  /** Aliases passed through from DB so colloquial names ("Kaiser", "Buchman") match too. */
  aliases?: string[];
};

type Props = {
  neighborhoods: SearchableNeighborhood[];
  onPick: (id: string) => void;
  /** Optional handler for the orange "AI" button at the end of the input. */
  onAIClick?: () => void;
};

type Match = {
  id: string;
  he: string;
  family: string | null;
  /** The alias that matched, if any — shown as parenthetical. */
  matchedAlias: string | null;
};

const MAX_RESULTS = 6;

function norm(s: string): string {
  return s.toLowerCase().trim();
}

function search(query: string, all: SearchableNeighborhood[]): Match[] {
  const q = norm(query);
  if (!q) return [];

  const results: { match: Match; score: number }[] = [];

  for (const n of all) {
    const nameMatchHe = norm(n.he).includes(q);
    const aliasHit = (n.aliases ?? []).find((a) => norm(a).includes(q));

    if (!nameMatchHe && !aliasHit) continue;

    // Scoring: official-name match > alias starts-with > alias contains.
    let score = 0;
    if (norm(n.he) === q) score = 100;
    else if (norm(n.he).startsWith(q)) score = 80;
    else if (nameMatchHe) score = 60;
    else if (aliasHit && norm(aliasHit) === q) score = 90;
    else if (aliasHit && norm(aliasHit).startsWith(q)) score = 70;
    else if (aliasHit) score = 50;

    results.push({
      match: {
        id: n.id,
        he: n.he,
        family: n.family,
        matchedAlias: !nameMatchHe && aliasHit ? aliasHit : null,
      },
      score,
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((r) => r.match);
}

export function NeighborhoodSearch({ neighborhoods, onPick, onAIClick }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => search(query, neighborhoods), [query, neighborhoods]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Reset highlight when matches change.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[highlight].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        className="mm-input"
        style={{
          width: 360,
          height: 40,
          boxShadow: "var(--shadow-md)",
          borderRadius: 999,
        }}
      >
        <MMIcon name="search" size={16} color="#84888E" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="חפשו: רחוב, שכונה, או 'בית עם גינה ובית ספר'"
        />
        <button
          type="button"
          onClick={onAIClick}
          className="mm-btn mm-btn-accent mm-btn-sm"
          style={{ height: 28 }}
          title="פתח את מומחה השכונה"
        >
          <MMIcon name="sparkle" size={12} color="#fff" /> AI
        </button>
      </div>

      {open && query.trim() && (
        <div
          style={{
            position: "absolute",
            top: 48,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid var(--stroke-weak)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: 320,
            overflow: "auto",
            zIndex: 5,
          }}
          className="mm-scroll"
          role="listbox"
        >
          {matches.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: "var(--grey-500)" }}>
              לא נמצאו שכונות עבור "{query}".
            </div>
          ) : (
            matches.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(m.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "start",
                  background: i === highlight ? "var(--grey-15)" : "#fff",
                  border: 0,
                  borderBottom: "1px solid var(--grey-15)",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--grey-900)" }}>
                    {m.he}
                  </span>
                  {m.matchedAlias && (
                    <span style={{ fontSize: 11, color: "var(--grey-500)" }}>
                      ({m.matchedAlias})
                    </span>
                  )}
                </div>
                {m.family && (
                  <div style={{ fontSize: 11, color: "var(--grey-500)", marginTop: 2 }}>
                    {m.family}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

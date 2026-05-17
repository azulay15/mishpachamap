"use client";

import { useMemo, useState } from "react";

export type PartyResult = {
  partyId: string;
  partyHe: string;
  color: string;
  votes: number;
  pct: number;
};

export type NeighborhoodElection = {
  electionId: string;
  electionHe: string;
  date: string; // ISO
  results: PartyResult[]; // already sorted desc by votes
};

type Props = {
  election: NeighborhoodElection | null;
};

const TOP_N = 5;

export function ElectionsPanel({ election }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { stacked, totalVotes } = useMemo(() => {
    if (!election || election.results.length === 0) return { stacked: [], totalVotes: 0 };
    const total = election.results.reduce((s, r) => s + r.votes, 0);
    const top = election.results.slice(0, TOP_N);
    const otherVotes = election.results.slice(TOP_N).reduce((s, r) => s + r.votes, 0);
    const stack: PartyResult[] = [...top];
    if (otherVotes > 0) {
      stack.push({
        partyId: "_other",
        partyHe: "אחרים",
        color: "#84888E",
        votes: otherVotes,
        pct: total > 0 ? (otherVotes / total) * 100 : 0,
      });
    }
    return { stacked: stack, totalVotes: total };
  }, [election]);

  if (!election || election.results.length === 0) {
    return null;
  }

  const visible = expanded ? election.results : election.results.slice(0, TOP_N);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 11, color: "var(--grey-500)" }}>
          {election.electionHe} · {totalVotes.toLocaleString("he-IL")} קולות
        </div>
        <a
          href="https://www.bechirot.gov.il/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 10, color: "var(--text-link)", textDecoration: "none" }}
        >
          מקור: ועדת הבחירות
        </a>
      </div>

      {/* Stacked horizontal bar. RTL direction so the largest party renders
          at the right edge, matching how Hebrew readers expect ranks. */}
      <div
        role="img"
        aria-label={`התפלגות הצבעה: ${stacked
          .map((s) => `${s.partyHe} ${Math.round(s.pct)}%`)
          .join(", ")}`}
        style={{
          height: 10,
          width: "100%",
          borderRadius: 6,
          overflow: "hidden",
          display: "flex",
          background: "var(--grey-15)",
        }}
      >
        {stacked.map((s) => (
          <div
            key={s.partyId}
            title={`${s.partyHe} · ${s.votes.toLocaleString("he-IL")} (${s.pct.toFixed(1)}%)`}
            style={{
              width: `${s.pct}%`,
              background: s.color,
              minWidth: s.pct > 0 ? 2 : 0,
            }}
          />
        ))}
      </div>

      {/* Legend / numeric breakdown. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {visible.map((r) => (
          <div
            key={r.partyId}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 8,
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: r.color,
                flex: "none",
              }}
            />
            <span style={{ color: "var(--grey-900)", fontWeight: 600 }}>{r.partyHe}</span>
            <span
              style={{
                fontFamily: "var(--font-inter, Inter)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--grey-700)",
              }}
            >
              {r.pct.toFixed(1)}% · {r.votes.toLocaleString("he-IL")}
            </span>
          </div>
        ))}
      </div>

      {election.results.length > TOP_N && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mm-btn mm-btn-ghost mm-btn-sm"
          style={{ alignSelf: "stretch", justifyContent: "center" }}
        >
          {expanded
            ? "הצג פחות"
            : `הצג עוד ${election.results.length - TOP_N} מפלגות`}
        </button>
      )}
    </div>
  );
}

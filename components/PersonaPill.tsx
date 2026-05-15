"use client";

import { useRouter } from "next/navigation";
import { PERSONA_DEFAULT } from "@/lib/persona";
import { NISshort } from "@/lib/format";

export function PersonaPill() {
  const router = useRouter();
  const p = PERSONA_DEFAULT;
  const initial = p.name.replace(/^משפחת\s*/, "").slice(0, 1) || "ל";
  const summary = `· ${p.size} נפשות · ${NISshort(p.budget.min)}–${NISshort(p.budget.max)}`;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        borderRadius: 999,
        padding: "6px 12px 6px 6px",
        boxShadow: "var(--shadow-md)",
        height: 40,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--pumpkin-orange)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 13,
          fontFamily: "var(--font-inter, Inter)",
          flex: "none",
        }}
      >
        {initial}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--grey-900)" }}>{p.name}</span>
      <span style={{ fontSize: 12, color: "var(--grey-500)" }}>{summary}</span>
      <button
        type="button"
        onClick={() => router.push("/onboarding?step=2")}
        className="mm-btn mm-btn-ghost mm-btn-sm"
        style={{ height: 28, padding: "0 8px", fontSize: 12 }}
      >
        ערוך
      </button>
    </div>
  );
}

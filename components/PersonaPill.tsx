"use client";

import { useRouter } from "next/navigation";
import { NISshort } from "@/lib/format";
import { usePersona } from "@/lib/usePersona";
import { MMIcon } from "@/lib/icons";
import { useIsMobile } from "@/lib/useMediaQuery";

export function PersonaPill() {
  const router = useRouter();
  const p = usePersona();
  const isMobile = useIsMobile();
  const initial = p.name.replace(/^משפחת\s*/, "").slice(0, 1) || "ל";

  // Mobile: collapse to a compact orange dot + edit. Tap anywhere on the pill
  // to open the persona editor (no separate "ערוך" label needed).
  if (isMobile) {
    return (
      <button
        type="button"
        onClick={() => router.push("/onboarding?step=2")}
        aria-label={`ערוך פרופיל: ${p.name}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#fff",
          borderRadius: 999,
          padding: "4px 10px 4px 4px",
          boxShadow: "var(--shadow-md)",
          height: 40,
          border: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          flex: "none",
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
        {p.celiacInFamily && (
          <MMIcon name="gluten" size={12} color="var(--layer-celiac)" />
        )}
        <MMIcon name="settings" size={13} color="var(--grey-500)" />
      </button>
    );
  }

  const summary = `· ${p.size} נפשות${p.kids.length > 0 ? ` · ${p.kids.length} ילדים` : ""} · ${NISshort(p.budget.min)}–${NISshort(p.budget.max)}`;
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
      {p.celiacInFamily && (
        <span
          title="צליאק במשפחה"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 6px",
            borderRadius: 999,
            background: "rgba(212,90,138,0.10)",
            color: "var(--layer-celiac)",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          <MMIcon name="gluten" size={10} color="var(--layer-celiac)" />
          ללא גלוטן
        </span>
      )}
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

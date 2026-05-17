"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NISshort } from "@/lib/format";
import { usePersona } from "@/lib/usePersona";
import { MMIcon } from "@/lib/icons";
import { useIsMobile } from "@/lib/useMediaQuery";

export function PersonaPill() {
  const router = useRouter();
  const p = usePersona();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Family-name only (drop the "משפחת" prefix for the avatar initial; keep it
  // in the displayed text). Allows long names like "משפחת לארי אזולאי" to
  // render the right initial.
  const familyName = p.name.replace(/^משפחת\s*/, "");
  const initial = familyName.slice(0, 1) || "ל";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isMobile) {
    // Mobile keeps the avatar-only tap target — straight to the editor.
    return (
      <button
        type="button"
        onClick={() => router.push("/onboarding?step=2")}
        aria-label={`ערוך פרופיל: ${p.name}`}
        style={pillBase}
      >
        <Avatar initial={initial} />
        {p.celiacInFamily && <MMIcon name="gluten" size={12} color="var(--layer-celiac)" />}
        <MMIcon name="settings" size={13} color="var(--grey-500)" />
      </button>
    );
  }

  // Desktop: compact pill (avatar + family name + edit), full details in a
  // popover. Removes the wide "X נפשות · Y ילדים · ₪Z–₪W · ערוך" strip.
  return (
    <div ref={wrapRef} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`פרטי פרסונה: ${p.name}`}
        style={{
          ...pillBase,
          padding: "4px 12px 4px 4px",
          maxWidth: 220,
        }}
      >
        <Avatar initial={initial} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--grey-900)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {familyName}
        </span>
        {p.celiacInFamily && (
          <MMIcon name="gluten" size={12} color="var(--layer-celiac)" />
        )}
        <MMIcon name="chevron-down" size={14} color="var(--grey-500)" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="פרטי פרסונה"
          style={{
            position: "absolute",
            top: 48,
            insetInlineEnd: 0,
            zIndex: 6,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            padding: 14,
            width: 280,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar initial={initial} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--grey-900)" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--grey-500)" }}>פרופיל ההתאמה הנוכחי</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              fontSize: 12,
              color: "var(--grey-700)",
            }}
          >
            <Stat label="נפשות" value={String(p.size)} />
            <Stat label="ילדים" value={String(p.kids.length)} />
            <Stat label="חדרים" value={`${p.rooms.min}–${p.rooms.max}`} />
            <Stat label="תקציב" value={`${NISshort(p.budget.min)}–${NISshort(p.budget.max)}`} />
          </div>

          {p.celiacInFamily && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(212,90,138,0.08)",
                color: "var(--layer-celiac)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <MMIcon name="gluten" size={12} color="var(--layer-celiac)" />
              צליאק במשפחה — מועדף Celiac-Friendly
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/onboarding?step=2");
            }}
            className="mm-btn mm-btn-secondary mm-btn-sm"
            style={{ alignSelf: "stretch", justifyContent: "center" }}
          >
            <MMIcon name="settings" size={12} /> ערוך פרסונה
          </button>
        </div>
      )}
    </div>
  );
}

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  borderRadius: 999,
  padding: "4px 10px 4px 4px",
  boxShadow: "var(--shadow-md)",
  height: 40,
  border: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  flex: "none",
  whiteSpace: "nowrap",
};

function Avatar({ initial, size = 28 }: { initial: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--pumpkin-orange)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size <= 28 ? 13 : 14,
        fontFamily: "var(--font-inter, Inter)",
        flex: "none",
      }}
    >
      {initial}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--grey-15)",
        borderRadius: 6,
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 10, color: "var(--grey-500)", fontWeight: 600 }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--grey-900)",
          fontFamily: "var(--font-inter, Inter)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

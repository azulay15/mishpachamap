"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONA_DEFAULT, type Persona } from "@/lib/persona";
import { writePersona, resetPersona } from "@/lib/usePersona";
import { FEATURES } from "@/lib/match";
import { MMHeader } from "./MMHeader";
import { MMIcon } from "@/lib/icons";
import { NIS, NISshort } from "@/lib/format";

export function OnboardingForm() {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona>(PERSONA_DEFAULT);

  // Read existing persona (if any) on mount so the form starts populated.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("mishpachamap.persona.v1");
      if (raw) setPersona({ ...PERSONA_DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  /** Click a feature in either row.
   *  - If already in that list → remove (becomes "not classified").
   *  - Otherwise → add to that list AND remove from the other list (mutually exclusive). */
  const classify = (list: "must" | "nice", value: string) =>
    setPersona((p) => {
      const other = list === "must" ? "nice" : "must";
      const inCurrent = p[list].includes(value);
      return {
        ...p,
        [list]: inCurrent ? p[list].filter((x) => x !== value) : [...p[list], value],
        [other]: p[other].filter((x) => x !== value),
      };
    });

  const setKids = (count: number) => {
    const kids = Array.from({ length: count }, (_, i) => ({
      age: 6 + i * 3,
      label: i === 0 ? "כיתה א׳" : `ילד ${i + 1}`,
    }));
    setPersona((p) => ({ ...p, kids }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    writePersona(persona);
    router.push("/");
  };

  const onReset = () => {
    resetPersona();
    setPersona(PERSONA_DEFAULT);
  };

  return (
    <div className="mm-shell" style={{ minHeight: "100vh" }}>
      <MMHeader activeNav="" />
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        <h2 style={{ marginBottom: 8 }}>הגדרת פרופיל המשפחה</h2>
        <p style={{ color: "var(--grey-700)", marginBottom: 24, fontSize: 14 }}>
          שינוי הפרופיל יחשב מחדש את ציוני ההתאמה לכל שכונה.
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Field label="שם המשפחה">
            <div className="mm-input">
              <input
                value={persona.name}
                onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                placeholder="משפחת לוי"
              />
            </div>
          </Field>

          <Field label={`מספר ילדים: ${persona.kids.length}`}>
            <input
              type="range"
              min={0}
              max={5}
              value={persona.kids.length}
              onChange={(e) => setKids(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </Field>

          <Field label="צורך תזונתי">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--stroke-medium)",
                borderRadius: 6,
                cursor: "pointer",
                background: persona.celiacInFamily ? "rgba(212,90,138,0.06)" : "#fff",
                borderColor: persona.celiacInFamily ? "var(--layer-celiac)" : "var(--stroke-medium)",
              }}
            >
              <input
                type="checkbox"
                checked={!!persona.celiacInFamily}
                onChange={(e) => setPersona({ ...persona, celiacInFamily: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "var(--layer-celiac)" }}
              />
              <MMIcon name="gluten" size={16} color="var(--layer-celiac)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                בן משפחה עם צליאק
              </span>
              <span style={{ fontSize: 12, color: "var(--grey-500)", marginInlineStart: "auto" }}>
                מקדם שכונות עם מסעדות ומאפיות ללא גלוטן בטווח הליכה
              </span>
            </label>
          </Field>

          <Field label={`תקציב: ${NISshort(persona.budget.min)} – ${NISshort(persona.budget.max)}`}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <NumericField
                label="מינימום"
                value={persona.budget.min}
                onChange={(v) => setPersona({ ...persona, budget: { ...persona.budget, min: v } })}
              />
              <NumericField
                label="מקסימום"
                value={persona.budget.max}
                onChange={(v) => setPersona({ ...persona, budget: { ...persona.budget, max: v } })}
              />
            </div>
          </Field>

          <Field label="חדרים">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <NumericField
                label="מינימום"
                value={persona.rooms.min}
                onChange={(v) => setPersona({ ...persona, rooms: { ...persona.rooms, min: v } })}
              />
              <NumericField
                label="מקסימום"
                value={persona.rooms.max}
                onChange={(v) => setPersona({ ...persona, rooms: { ...persona.rooms, max: v } })}
              />
            </div>
          </Field>

          <Field label="חובה (Must-Have)">
            <ChipRow
              options={FEATURES}
              selected={persona.must}
              onToggle={(v) => classify("must", v)}
            />
          </Field>

          <Field label="כדאי (Nice-to-Have)">
            <ChipRow
              options={FEATURES}
              selected={persona.nice}
              onToggle={(v) => classify("nice", v)}
              variant="soft"
            />
          </Field>

          <p style={{ margin: 0, fontSize: 11, color: "var(--grey-500)" }}>
            לחיצה על תכונה בשורה אחת מעבירה אותה לשם. אותה תכונה לא יכולה להיות גם חובה וגם כדאי.
            תכונות שלא מסומנות באף שורה לא משפיעות על ציון ההתאמה.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="submit" className="mm-btn mm-btn-accent" style={{ flex: 1 }}>
              <MMIcon name="check" size={14} color="#fff" />
              שמרו ופתחו את המפה
            </button>
            <button
              type="button"
              className="mm-btn mm-btn-secondary"
              onClick={onReset}
              title="חזרה לערכי ברירת המחדל"
            >
              אפסו
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "var(--grey-500)" }}>
            הפרופיל נשמר בדפדפן בלבד (localStorage). אין שמירה בענן עדיין.
            תקציב: {NIS(persona.budget.min)} עד {NIS(persona.budget.max)}.
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--grey-700)" }}>{label}</span>
      {children}
    </label>
  );
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--grey-500)" }}>{label}</span>
      <div className="mm-input">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{ direction: "ltr", textAlign: "right" }}
        />
      </div>
    </div>
  );
}

function ChipRow({
  options,
  selected,
  onToggle,
  variant = "solid",
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  /** "solid" = filled charcoal on; "soft" = filled grey on (used for the nice row). */
  variant?: "solid" | "soft";
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        const cls = variant === "soft" ? "mm-chip mm-chip-soft" : "mm-chip";
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            aria-pressed={on}
            className={`${cls} ${on ? "mm-chip-on" : ""}`}
            style={{ height: 32, fontSize: 12, padding: "0 12px" }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

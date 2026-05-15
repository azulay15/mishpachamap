"use client";

import { useEffect, useRef, useState } from "react";
import { MMIcon } from "@/lib/icons";

export type LeadKind = "mortgage" | "inspection";

type Props = {
  kind: LeadKind;
  /** Optional context shown to the user + sent to the backend. */
  context?: {
    neighborhoodId?: string;
    listingId?: string;
    address?: string;
  };
  onClose: () => void;
};

const COPY: Record<
  LeadKind,
  { title: string; subtitle: string; cta: string; success: string; icon: string }
> = {
  mortgage: {
    title: "אישור עקרוני למשכנתא",
    subtitle:
      "השאירו פרטים ונחבר אתכם עם יועץ משכנתאות מומחה. החזרה תוך 24 שעות.",
    cta: "שלחו אליי הצעה",
    success: "תודה! יועץ משכנתאות יחזור אליכם תוך 24 שעות.",
    icon: "zap",
  },
  inspection: {
    title: "הזמנת בדק בית",
    subtitle:
      "השאירו פרטים ובודק בית מוסמך יצור איתכם קשר לתיאום מועד.",
    cta: "תאמו לי בדיקה",
    success: "תודה! נציג בודק הבית יחזור אליכם תוך 24 שעות.",
    icon: "shield",
  },
};

export function LeadGenModal({ kind, context, onClose }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const c = COPY[kind];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    firstInputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, phone, email, notes, context }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 70,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "min(520px, 100%)",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
        }}
        className="mm-scroll mm-modal-content"
      >
        <header
          style={{
            padding: "18px 20px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 14,
            borderBottom: "1px solid var(--stroke-weak)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background:
                kind === "mortgage" ? "var(--pumpkin-orange)" : "var(--grey-900)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
            }}
          >
            <MMIcon name={c.icon} size={18} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{c.title}</h3>
            <div style={{ fontSize: 12, color: "var(--grey-500)", marginTop: 2 }}>
              {c.subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mm-btn mm-btn-ghost mm-btn-sm"
            aria-label="סגור"
            style={{ padding: 6 }}
          >
            <MMIcon name="x" size={16} />
          </button>
        </header>

        {success ? (
          <div style={{ padding: 28, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--green-bg)",
                color: "var(--green-positive)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
              }}
            >
              <MMIcon name="check" size={26} color="currentColor" />
            </div>
            <h4 style={{ margin: 0, fontSize: 16 }}>{c.success}</h4>
            <button
              type="button"
              onClick={onClose}
              className="mm-btn mm-btn-secondary"
              style={{ marginTop: 16 }}
            >
              סגור
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            {context?.address && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--grey-700)",
                  background: "var(--grey-15)",
                  padding: "8px 10px",
                  borderRadius: 6,
                }}
              >
                <strong>הקשר:</strong> {context.address}
              </div>
            )}

            <Field label="שם מלא" required>
              <div className="mm-input">
                <input
                  ref={firstInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </Field>

            <Field label="טלפון" required>
              <div className="mm-input">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  pattern="[0-9\-+ ]{7,}"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="050-1234567"
                  style={{ direction: "ltr", textAlign: "start" }}
                />
              </div>
            </Field>

            <Field label="אימייל (לא חובה)">
              <div className="mm-input">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  style={{ direction: "ltr", textAlign: "start" }}
                />
              </div>
            </Field>

            <Field label="הערות (לא חובה)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--stroke-medium)",
                  borderRadius: 6,
                  fontFamily: "var(--font-heb)",
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </Field>

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--red-negative)",
                  background: "var(--red-bg)",
                  padding: "8px 10px",
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim() || !phone.trim()}
              className="mm-btn mm-btn-accent"
              style={{ height: 44, fontSize: 14 }}
            >
              {submitting ? "שולח…" : c.cta}
            </button>

            <p style={{ fontSize: 10, color: "var(--grey-500)", margin: 0, lineHeight: "14px" }}>
              שליחת הטופס מהווה הסכמה ליצירת קשר טלפוני. הפרטים יועברו לשותף עסקי בלבד ולא ישמרו במערכת.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--grey-700)" }}>
        {label}
        {required && <span style={{ color: "var(--pumpkin-orange)", marginInlineStart: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

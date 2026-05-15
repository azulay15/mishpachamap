"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MMIcon } from "@/lib/icons";

const DISMISS_KEY = "mishpachamap.welcome_dismissed.v1";
const PERSONA_KEY = "mishpachamap.persona.v1";

/** Soft welcome card shown to first-time visitors (no saved persona, no
 *  dismiss flag). Sits over the bottom-left of the map area; non-modal so
 *  users can keep exploring. Disappears once the user either sets up a
 *  persona via /onboarding or explicitly dismisses it. */
export function WelcomeCard() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const hasPersona = window.localStorage.getItem(PERSONA_KEY);
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      if (!hasPersona && !dismissed) setVisible(true);
    } catch {
      /* ignore — fail closed (don't show banner) */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        // Hover above the bottom carousel — the carousel itself sits at
        // bottom: 14 with ~180px height.
        bottom: 210,
        insetInlineStart: 14,
        zIndex: 5,
        maxWidth: 360,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--stroke-weak)",
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 12,
        alignItems: "start",
      }}
      role="region"
      aria-label="ברוכים הבאים ל-MishpachaMap"
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--pumpkin-orange)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          flex: "none",
        }}
      >
        <MMIcon name="sparkle" size={18} color="#fff" />
      </div>
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          ברוכים הבאים ל-MishpachaMap
        </strong>
        <p style={{ margin: 0, fontSize: 12, color: "var(--grey-700)", lineHeight: "18px" }}>
          הגדירו פרופיל משפחה וקבלו ציוני התאמה אמיתיים לכל שכונה — תקציב, גודל משפחה, צרכים תזונתיים ועוד.
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              dismiss();
              router.push("/onboarding");
            }}
            className="mm-btn mm-btn-accent mm-btn-sm"
          >
            הגדירו פרופיל
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="mm-btn mm-btn-ghost mm-btn-sm"
            style={{ fontSize: 12 }}
          >
            לא עכשיו
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגור"
        className="mm-btn mm-btn-ghost mm-btn-sm"
        style={{ padding: 4, flex: "none" }}
      >
        <MMIcon name="x" size={14} />
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { MMIcon } from "@/lib/icons";

/** Next.js App Router catches render/runtime errors via this file. Renders
 *  on top of any failing route segment instead of the default white screen. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mishpachamap] route error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "var(--font-heb)",
        background: "var(--surface-page)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          padding: 32,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--stroke-weak)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--red-bg)",
            color: "var(--red-negative)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 14px",
          }}
        >
          <MMIcon name="info" size={26} color="currentColor" />
        </div>
        <h3 style={{ margin: 0, marginBottom: 8 }}>משהו השתבש</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--grey-700)", lineHeight: "20px" }}>
          התרחשה שגיאה לא צפויה במהלך הטעינה. ניתן לנסות שוב או לחזור למפה הראשית.
        </p>

        <details
          style={{
            margin: "16px auto 0",
            maxWidth: 360,
            fontSize: 11,
            color: "var(--grey-500)",
            background: "var(--grey-15)",
            borderRadius: 6,
            padding: 8,
            textAlign: "start",
            direction: "ltr",
          }}
        >
          <summary style={{ cursor: "pointer" }}>פרטי שגיאה (לדיבאג)</summary>
          <pre
            style={{
              margin: "8px 0 0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-inter, Inter)",
              fontSize: 10,
            }}
          >
            {error.message}
            {error.digest ? `\n[digest: ${error.digest}]` : ""}
          </pre>
        </details>

        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "center" }}>
          <button type="button" onClick={reset} className="mm-btn mm-btn-accent">
            נסו שוב
          </button>
          <a href="/" className="mm-btn mm-btn-secondary" style={{ textDecoration: "none" }}>
            חזרה למפה
          </a>
        </div>
      </div>
    </div>
  );
}

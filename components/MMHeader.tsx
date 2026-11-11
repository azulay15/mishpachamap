"use client";

import { MMIcon } from "@/lib/icons";
import { SproutMark } from "@/components/BrandLogo";
import { useFavorites } from "@/lib/useFavorites";
import { usePersona } from "@/lib/usePersona";

// Label → destination. Only links that go somewhere real: `/map` resolves to
// the visitor's last city on the server, and `?view=` opens the matching panel.
const NAV: Array<{ label: string; href: string }> = [
  { label: "בית", href: "/" },
  { label: "מפה", href: "/map" },
  { label: "שכונות", href: "/map?view=list" },
  { label: "מומחה השכונה", href: "/map?view=ai" },
];

export function MMHeader({ activeNav = "מפה" }: { activeNav?: string }) {
  const { count } = useFavorites();
  const persona = usePersona();
  return (
    <header>
      <div className="mm-header-utility">
        <span style={{ opacity: 0.6 }}>שלום, {persona.name}</span>
        <a href="/onboarding" style={{ marginInlineStart: "auto" }}>פרופיל המשפחה</a>
      </div>
      <div className="mm-header-main">
        <a href="/" className="mm-logo" aria-label="הנחלה, לדף הבית">
          <SproutMark size={30} />
          <span>הנחלה</span>
        </a>
        <nav>
          {NAV.map((n) => (
            <a key={n.label} href={n.href} className={n.label === activeNav ? "on" : ""}>
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href="/saved"
          className="mm-btn mm-btn-secondary mm-btn-sm mm-header-saved"
          style={{ textDecoration: "none", color: "var(--grey-900)", fontWeight: 700, position: "relative" }}
        >
          <MMIcon
            name={count > 0 ? "heart-fill" : "heart"}
            size={14}
            color={count > 0 ? "var(--hn-accent)" : "currentColor"}
          />
          שמורים
          {count > 0 && (
            <span
              style={{
                background: "var(--hn-primary)",
                color: "var(--hn-on-primary)",
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 999,
                padding: "1px 6px",
                marginInlineStart: 2,
                fontFamily: "var(--font-inter, Inter)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}

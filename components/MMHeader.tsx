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
        {/* The family profile — what every match score is computed from. (This
            used to sit in a separate dark strip above the bar.) */}
        <a
          href="/onboarding"
          className="mm-btn mm-btn-ghost mm-btn-sm mm-header-profile"
          style={{ textDecoration: "none", marginInlineStart: "auto", gap: 6 }}
          aria-label={`פרופיל המשפחה: ${persona.name}`}
          title="עריכת פרופיל המשפחה"
        >
          <MMIcon name="users" size={15} />
          <span>{persona.name}</span>
        </a>
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

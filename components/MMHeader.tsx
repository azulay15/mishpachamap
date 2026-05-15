"use client";

import { MMIcon } from "@/lib/icons";
import { useFavorites } from "@/lib/useFavorites";

const NAV = ["בית", "מפה", "שכונות", "נכסים", "מחשבונים", "מומחה השכונה"];

export function MMHeader({ activeNav = "מפה" }: { activeNav?: string }) {
  const { count } = useFavorites();
  return (
    <header>
      <div className="mm-header-utility">
        <span style={{ opacity: 0.6 }}>שלום, משפחת לוי</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <a href="#">העדפות</a>
        <a href="#">חשבון</a>
        <span style={{ marginInlineStart: "auto", opacity: 0.6 }}>עדכון אחרון: 14:32</span>
        <a href="#" style={{ color: "#FF6B00", fontWeight: 700 }}>שדרגו ל-Pro</a>
        <a href="#" aria-label="שפה"><MMIcon name="globe" size={14} color="#fff" /></a>
      </div>
      <div className="mm-header-main">
        <a href="/" className="mm-logo">
          MishpachaMap<span className="lg-dot">.</span>
        </a>
        <nav>
          {NAV.map((n) => (
            <a key={n} href="#" className={n === activeNav ? "on" : ""}>
              {n}
            </a>
          ))}
        </nav>
        <div className="mm-input" style={{ width: 280, height: 36 }}>
          <MMIcon name="search" size={16} color="#84888E" />
          <input placeholder="חפשו שכונה, רחוב או נכס" />
        </div>
        <button className="mm-btn mm-btn-ghost mm-btn-sm" aria-label="התראות">
          <MMIcon name="bell" size={16} />
        </button>
        <a
          href="/saved"
          className="mm-btn mm-btn-secondary mm-btn-sm"
          style={{ textDecoration: "none", color: "var(--grey-900)", fontWeight: 700, position: "relative" }}
        >
          <MMIcon
            name={count > 0 ? "heart-fill" : "heart"}
            size={14}
            color={count > 0 ? "var(--pumpkin-orange)" : "currentColor"}
          />
          שמורים
          {count > 0 && (
            <span
              style={{
                background: "var(--pumpkin-orange)",
                color: "#fff",
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

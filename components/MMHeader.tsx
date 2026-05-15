import { MMIcon } from "@/lib/icons";

const NAV = ["בית", "מפה", "שכונות", "נכסים", "מחשבונים", "מומחה השכונה"];

export function MMHeader({ activeNav = "מפה" }: { activeNav?: string }) {
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
        <button className="mm-btn mm-btn-secondary mm-btn-sm">
          <MMIcon name="heart" size={14} /> שמורים
        </button>
      </div>
    </header>
  );
}

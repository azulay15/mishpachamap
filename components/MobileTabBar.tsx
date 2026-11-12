"use client";

import { MMIcon } from "@/lib/icons";
import { useFavorites } from "@/lib/useFavorites";

export type MobileTab = "map" | "list" | "saved" | "ai";

type Props = {
  active?: MobileTab | null;
  /** On the map screen these switch views in place; elsewhere the tabs are
   *  plain links (`/map` resolves to the visitor's last city on the server). */
  onMap?: () => void;
  onList?: () => void;
  onAI?: () => void;
};

const TABS: { id: MobileTab; label: string; icon: string; href: string }[] = [
  { id: "map", label: "מפה", icon: "map", href: "/map" },
  { id: "list", label: "שכונות", icon: "list", href: "/map?view=list" },
  { id: "saved", label: "שמורים", icon: "heart", href: "/saved" },
  { id: "ai", label: "מומחה", icon: "sparkle", href: "/map?view=ai" },
];

/**
 * Bottom tab bar — phones only (hidden ≥769px in CSS, so there is no flash
 * while the client works out the viewport). The top nav is hidden on phones;
 * this is how you get around.
 */
export function MobileTabBar({ active = null, onMap, onList, onAI }: Props) {
  const { count } = useFavorites();
  const handlers: Partial<Record<MobileTab, (() => void) | undefined>> = {
    map: onMap,
    list: onList,
    ai: onAI,
  };

  return (
    <nav className="mm-tabbar" aria-label="ניווט ראשי" dir="rtl">
      {TABS.map((t) => {
        const on = t.id === active;
        const handler = handlers[t.id];
        const inner = (
          <>
            <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
              <MMIcon
                name={t.id === "saved" && count > 0 ? "heart-fill" : t.icon}
                size={21}
                color={on ? "var(--hn-primary)" : "var(--hn-text-3)"}
              />
              {t.id === "saved" && count > 0 && <span className="mm-tabbar-badge">{count}</span>}
            </span>
            <span>{t.label}</span>
          </>
        );
        return handler ? (
          <button key={t.id} type="button" onClick={handler} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {inner}
          </button>
        ) : (
          <a key={t.id} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {inner}
          </a>
        );
      })}
    </nav>
  );
}

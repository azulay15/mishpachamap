"use client";

import { useEffect, useState } from "react";

/** Reactive matchMedia hook. SSR-safe (returns false on the server). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience: true on viewports ≤ 768px wide (phones, narrow tablets). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)");
}

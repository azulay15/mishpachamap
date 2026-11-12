/**
 * "Last city the visitor looked at" — a plain first-party cookie, so the
 * SERVER can use it: `/map` redirects to that city and Home shows its data,
 * instead of always falling back to the default city.
 */
import { defaultCity, getCity, type City } from "./cities";

export const LAST_CITY_COOKIE = "mm_city";

/** Resolve the cookie value to a live city (default city when unset/unknown). */
export function cityFromCookie(value: string | undefined): City {
  const c = value ? getCity(value) : undefined;
  return c && c.status === "live" ? c : defaultCity();
}

/** Remember the city (client only). */
export function rememberCity(slug: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LAST_CITY_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

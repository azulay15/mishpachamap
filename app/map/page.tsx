import { redirect } from "next/navigation";
import { defaultCity } from "@/lib/cities";

export const revalidate = 60;

/**
 * Legacy `/map` entry. The map is now per-city at `/map/[city]`; this redirects
 * to the default city, preserving any `?n=<id>` (and other) deep-link query so
 * old shared links and bookmarks keep working.
 */
export default async function MapIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v.length > 0) qs.set(k, v[0]);
  }
  const query = qs.toString();
  redirect(`/map/${defaultCity().slug}${query ? `?${query}` : ""}`);
}

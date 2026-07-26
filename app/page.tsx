import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";
import { HomeScreen } from "@/components/HomeScreen";
import { MOCK_DATA } from "@/lib/mockData";
import { fetchConciergeData } from "@/lib/assembleConcierge";
import { defaultCity } from "@/lib/cities";

export const revalidate = 60;

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Home — the root route. A hybrid landing page: a marketing hero for
 * first-time visitors, switching to a personalized dashboard once a persona
 * exists in localStorage (the switch happens client-side in HomeScreen).
 *
 * The map used to live at `/`; it is now at `/map`. Old deep links of the form
 * `/?n=<neighborhood>` (shared URLs, bookmarks) are redirected there with the
 * full query string preserved.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.n !== undefined) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") qs.set(k, v);
      else if (Array.isArray(v) && v.length > 0) qs.set(k, v[0]);
    }
    redirect(`/map/${defaultCity().slug}?${qs.toString()}`);
  }

  if (!envConfigured()) {
    return <HomeScreen data={MOCK_DATA} />;
  }

  const cookieStore = await cookies();
  const sb = serverSupabase(cookieStore);
  const data = await fetchConciergeData(sb);

  return <HomeScreen data={data ?? MOCK_DATA} />;
}

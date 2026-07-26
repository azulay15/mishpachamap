import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";
import { ConciergeScreen } from "@/components/ConciergeScreen";
import { CityComingSoon } from "@/components/CityComingSoon";
import { MOCK_DATA } from "@/lib/mockData";
import { fetchConciergeData } from "@/lib/assembleConcierge";
import { CITIES, getCity } from "@/lib/cities";

export const revalidate = 60;

/** Enumerate the known city slugs; unknown slugs 404 at request time. */
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  );
}

/**
 * Per-city interactive map — `/map/[city]`. The city is resolved from the URL
 * slug against the static registry (lib/cities.ts); unknown slugs 404, and a
 * city whose data isn't built yet shows a coming-soon teaser. Data assembly is
 * scoped to the city in lib/assembleConcierge.ts.
 */
export default async function CityMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  if (city.status === "coming-soon") {
    return <CityComingSoon city={city} />;
  }

  // Server-read `?n=<id>` deep link → pre-select that neighborhood (no client race).
  const sp = await searchParams;
  const initialSelected = typeof sp.n === "string" ? sp.n : undefined;

  // No env → preview mode against handoff mock data with the SVG stub map.
  if (!envConfigured()) {
    return <ConciergeScreen data={MOCK_DATA} renderer="stub" city={city} initialSelected={initialSelected} />;
  }

  const cookieStore = await cookies();
  const sb = serverSupabase(cookieStore);
  const data = await fetchConciergeData(sb, city);

  // Live city but no polygons (shouldn't happen) → teaser rather than mock.
  if (!data) {
    return <CityComingSoon city={city} />;
  }

  return <ConciergeScreen data={data} renderer="mapbox" city={city} initialSelected={initialSelected} />;
}

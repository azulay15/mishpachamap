import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { serverSupabase } from "@/lib/supabase";
import { ConciergeScreen } from "@/components/ConciergeScreen";
import { CityComingSoon } from "@/components/CityComingSoon";
import { MOCK_DATA } from "@/lib/mockData";
import { fetchConciergeData } from "@/lib/assembleConcierge";
import { CITIES, getCity } from "@/lib/cities";
import { loadNeighborhoodFeatures } from "@/lib/geoData";

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

type PageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Per-page title + link preview. A shared `?n=<id>` link names that
 * neighborhood and gets a preview image with its polygon highlighted
 * (app/api/og); a bare city link gets the city's.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  const sp = await searchParams;
  const n = typeof sp.n === "string" ? sp.n : undefined;
  const hood = n
    ? loadNeighborhoodFeatures(city).features.find((f) => f.properties.id === n)
    : undefined;

  const hebrew = city.lang !== "en";
  const cityName = hebrew ? city.name_he : city.name_en;
  const hoodName = hood ? (hebrew ? hood.properties.name_he : hood.properties.name_en || hood.properties.name_he) : null;
  const title = hoodName ? `${hoodName}, ${cityName}` : hebrew ? `מפת השכונות של ${cityName}` : `${cityName} neighborhood map`;
  const description = hebrew
    ? hoodName
      ? `${hoodName} ב${cityName}: בתי ספר, פארקים, בטיחות וציון התאמה למשפחה שלכם, על המפה.`
      : `כל השכונות ב${cityName} על מפה אחת, מדורגות לפי ההתאמה למשפחה שלכם.`
    : `Schools, parks, safety and a family-fit score for ${hoodName ?? cityName}, on the map.`;

  const og = new URLSearchParams({ city: city.slug });
  if (hood) og.set("n", hood.properties.id);
  const image = { url: `/api/og?${og.toString()}`, width: 1200, height: 630 };
  const path = `/map/${city.slug}${hood ? `?n=${hood.properties.id}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "הנחלה", title, description, url: path, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

/**
 * Per-city interactive map — `/map/[city]`. The city is resolved from the URL
 * slug against the static registry (lib/cities.ts); unknown slugs 404, and a
 * city whose data isn't built yet shows a coming-soon teaser. Data assembly is
 * scoped to the city in lib/assembleConcierge.ts.
 */
export default async function CityMapPage({ params, searchParams }: PageProps) {
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

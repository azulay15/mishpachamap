import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase";
import { ConciergeScreen } from "@/components/ConciergeScreen";
import { MOCK_DATA } from "@/lib/mockData";
import { fetchConciergeData } from "@/lib/assembleConcierge";

export const revalidate = 60;

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  );
}

/**
 * The interactive map (formerly the root route — the root is now the Home
 * page, which redirects legacy `/?n=<id>` deep links here). Data assembly
 * lives in lib/assembleConcierge.ts, shared with Home.
 */
export default async function MapPage() {
  // No env → preview mode against handoff mock data with the SVG stub map.
  if (!envConfigured()) {
    return <ConciergeScreen data={MOCK_DATA} renderer="stub" />;
  }

  const cookieStore = await cookies();
  const sb = serverSupabase(cookieStore);
  const data = await fetchConciergeData(sb);

  // Empty database → still preview mode (chrome only).
  if (!data) {
    return <ConciergeScreen data={MOCK_DATA} renderer="stub" />;
  }

  return <ConciergeScreen data={data} renderer="mapbox" />;
}

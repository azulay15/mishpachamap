import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase";
import { SavedView, type SavedNeighborhood, type SavedListing } from "@/components/SavedView";
import { MOCK_DATA } from "@/lib/mockData";

export const revalidate = 60;

function envConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export default async function SavedPage() {
  let neighborhoods: SavedNeighborhood[] = [];
  let listings: SavedListing[] = [];

  if (envConfigured()) {
    const cookieStore = await cookies();
    const sb = serverSupabase(cookieStore);
    const [{ data: nbs }, { data: lst }] = await Promise.all([
      sb.from("neighborhoods").select("id, name_he, family_label, summary_he"),
      sb.from("listings").select("id, neighborhood, address, price_nis, rooms, sqm, garden_sqm, status_he"),
    ]);
    neighborhoods = (nbs ?? []).map((n) => ({
      id: n.id as string,
      he: n.name_he as string,
      family: n.family_label as string | null,
      summary: n.summary_he as string | null,
    }));
    listings = (lst ?? []).map((l) => ({
      id: l.id as string,
      neighborhood: l.neighborhood as string | null,
      address: (l.address as string | null) ?? "",
      price_nis: Number(l.price_nis ?? 0),
      rooms: Number(l.rooms ?? 0),
      sqm: Number(l.sqm ?? 0),
      garden_sqm: l.garden_sqm as number | null,
      status_he: l.status_he as string | null,
    }));
  }

  // Fallback to mock-mode data so the page works in preview mode too.
  if (neighborhoods.length === 0) {
    neighborhoods = MOCK_DATA.neighborhoods.map((n) => ({
      id: n.id,
      he: n.he,
      family: n.family,
      summary: n.summary,
    }));
  }
  if (listings.length === 0) {
    listings = Object.values(MOCK_DATA.listingsByNeighborhood)
      .flat()
      .map((l) => ({
        id: l.id,
        neighborhood: null,
        address: l.address,
        price_nis: l.price_nis,
        rooms: l.rooms,
        sqm: l.sqm,
        garden_sqm: l.garden_sqm,
        status_he: l.status_he,
      }));
  }

  return <SavedView neighborhoods={neighborhoods} listings={listings} />;
}

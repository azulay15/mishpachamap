import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase";

export const revalidate = 60;

export async function GET() {
  const cookieStore = await cookies();
  const sb = serverSupabase(cookieStore);
  const { data, error } = await sb
    .from("neighborhoods")
    .select("id, name_he, name_en, family_label, summary_he, polygon, center, tags");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ neighborhoods: data ?? [] });
}

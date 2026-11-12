import type { Metadata } from "next";
import { MoreForLess, type HomeOption } from "@/components/MoreForLess";
import { crossCityIndex } from "@/lib/crossCity";

export const metadata: Metadata = {
  title: "יותר בפחות",
  description: "ספרו לנו איפה אתם גרים וכמה אתם משלמים, ונראה לכם שכונות שבהן משפחה כמוכם משלמת פחות, קרוב לעבודה.",
};

export default function MoreForLessPage() {
  // Slim list for the "where do you live now" pickers; ranking happens in the API.
  const options: HomeOption[] = crossCityIndex().map((n) => ({
    id: n.id,
    he: n.he,
    cityId: n.cityId,
    cityHe: n.cityHe,
    rent: n.rent,
    buy: n.buy,
  }));
  return <MoreForLess options={options} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""} />;
}

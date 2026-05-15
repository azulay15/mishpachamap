import { loadNeighborhoodFeatures } from "@/lib/geoData";
import { PolygonEditor } from "@/components/PolygonEditor";

export const dynamic = "force-dynamic";

export default function DrawPage() {
  const initial = loadNeighborhoodFeatures();
  return <PolygonEditor initial={initial} />;
}

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { adminSupabase } from "./supabase";
import { breakdownFor, type NeighborhoodFacts } from "./match";
import type { Persona } from "./persona";
import { PERSONA_DEFAULT } from "./persona";

/** Tool schemas exposed to Claude. The model decides when to call them based
 *  on user intent. Names + descriptions are the model's only docs — keep them
 *  precise. */
export const TOOLS: Tool[] = [
  {
    name: "query_neighborhoods",
    description:
      "Search Modi'in neighborhoods by structured filters. Use this when the user asks for neighborhoods matching criteria " +
      "like a budget range, walking distance to schools, having parks/Celiac venues nearby, or matching a family-type label. " +
      "Returns up to 7 neighborhoods sorted by best match for the current persona.",
    input_schema: {
      type: "object",
      properties: {
        max_listing_price_nis: {
          type: "number",
          description: "Max average listing price in NIS. Optional.",
        },
        min_listing_price_nis: {
          type: "number",
          description: "Min average listing price in NIS. Optional.",
        },
        needs_celiac_friendly: {
          type: "boolean",
          description: "True if family needs gluten-free venues nearby. Adds Celiac proximity to ranking.",
        },
        family_label_contains: {
          type: "string",
          description: "Substring match against the neighborhood's family character (e.g. 'דתי-לאומי', 'חילוני', 'משפחתי').",
        },
        limit: { type: "number", description: "Max results (default 5)." },
      },
    },
  },
  {
    name: "compare_neighborhoods",
    description:
      "Compare 2-4 specific neighborhoods side-by-side on price, GreenScore, school score, distance to amenities, and Celiac availability.",
    input_schema: {
      type: "object",
      properties: {
        neighborhood_ids: {
          type: "array",
          items: { type: "string" },
          description: "Internal IDs (e.g. 'hashvatim', 'moriah'). Look up by alias if the user uses a colloquial name like 'Buchman'.",
        },
      },
      required: ["neighborhood_ids"],
    },
  },
  {
    name: "get_match_breakdown",
    description:
      "Return the persona-aware match breakdown for a single neighborhood. Use when user asks 'why this neighborhood?' or 'how well does X match us?'.",
    input_schema: {
      type: "object",
      properties: {
        neighborhood_id: { type: "string", description: "Internal ID (e.g. 'buchman' or look up by alias)." },
      },
      required: ["neighborhood_id"],
    },
  },
];

type ToolResult = { content: string; sources?: string[] };

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  persona: Persona = PERSONA_DEFAULT,
): Promise<ToolResult> {
  const sb = adminSupabase();

  if (name === "query_neighborhoods") {
    return queryNeighborhoods(sb, input, persona);
  }
  if (name === "compare_neighborhoods") {
    return compareNeighborhoods(sb, input, persona);
  }
  if (name === "get_match_breakdown") {
    return getMatchBreakdown(sb, input, persona);
  }
  return { content: `Unknown tool: ${name}` };
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

type DBNeighborhood = {
  id: string;
  name_he: string;
  family_label: string | null;
  summary_he: string | null;
  aliases: string[] | null;
};

type DBMetrics = {
  neighborhood: string;
  avg_price_per_m2: number | null;
  avg_price_yoy_pct: number | null;
  avg_listing_price: number | null;
  green_score: number | null;
  school_score: number | null;
  quiet_score: number | null;
};

type DBPOI = { type: string; point: { coordinates: [number, number] } | null };
type DBSchool = { meitzav_score: number | null; point: { coordinates: [number, number] } | null };
type DBNbCenter = { id: string; center: { coordinates: [number, number] } };

type SbClient = ReturnType<typeof adminSupabase>;

async function loadCorpus(sb: SbClient) {
  const [{ data: nbs }, { data: nbCenters }, { data: metrics }, { data: pois }, { data: schools }] =
    await Promise.all([
      sb.from("neighborhoods").select("id, name_he, family_label, summary_he, aliases"),
      sb.from("neighborhoods_geojson").select("id, center"),
      sb.from("neighborhood_metrics").select("*"),
      sb.from("pois_geojson").select("type, point"),
      sb.from("schools_geojson").select("meitzav_score, point"),
    ]);

  const centerById = new Map<string, [number, number]>();
  for (const c of (nbCenters ?? []) as DBNbCenter[]) {
    if (c.center) centerById.set(c.id, c.center.coordinates);
  }

  const metricsByNb = new Map<string, DBMetrics>();
  for (const m of (metrics ?? []) as DBMetrics[]) {
    metricsByNb.set(m.neighborhood, m);
  }

  return {
    nbs: (nbs ?? []) as DBNeighborhood[],
    centerById,
    metricsByNb,
    pois: (pois ?? []) as DBPOI[],
    schools: (schools ?? []) as DBSchool[],
  };
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestPoiMeters(from: [number, number], pois: DBPOI[], type: string): number | null {
  let best: number | null = null;
  for (const p of pois) {
    if (p.type !== type || !p.point) continue;
    const d = haversineMeters(from, p.point.coordinates);
    if (best == null || d < best) best = d;
  }
  return best;
}

function nearestSchoolMeters(from: [number, number], schools: DBSchool[]): number | null {
  let best: number | null = null;
  for (const s of schools) {
    if (!s.point) continue;
    const d = haversineMeters(from, s.point.coordinates);
    if (best == null || d < best) best = d;
  }
  return best;
}

function poisWithin(from: [number, number], pois: DBPOI[], type: string, meters: number): number {
  let count = 0;
  for (const p of pois) {
    if (p.type !== type || !p.point) continue;
    if (haversineMeters(from, p.point.coordinates) <= meters) count++;
  }
  return count;
}

function factsFor(
  nb: DBNeighborhood,
  metrics: DBMetrics | undefined,
  center: [number, number],
  pois: DBPOI[],
  schools: DBSchool[],
): NeighborhoodFacts {
  return {
    id: nb.id,
    avgListing: metrics?.avg_listing_price ?? null,
    gardenAvailability: 0.4, // placeholder; full computation lives in app/page.tsx
    schoolWalkMeters: nearestSchoolMeters(center, schools),
    parkMeters: nearestPoiMeters(center, pois, "park"),
    shopMeters: nearestPoiMeters(center, pois, "shop"),
    transitMeters: nearestPoiMeters(center, pois, "transit"),
    quietScore: metrics?.quiet_score ?? 70,
    greenScore: metrics?.green_score ?? 70,
    celiacDistance: nearestPoiMeters(center, pois, "celiac"),
    celiacDensity: poisWithin(center, pois, "celiac", 1000),
  };
}

async function queryNeighborhoods(
  sb: SbClient,
  input: Record<string, unknown>,
  persona: Persona,
): Promise<ToolResult> {
  const { nbs, centerById, metricsByNb, pois, schools } = await loadCorpus(sb);
  const limit = Math.max(1, Math.min(7, Number(input.limit ?? 5)));
  const maxPrice = Number(input.max_listing_price_nis ?? Infinity);
  const minPrice = Number(input.min_listing_price_nis ?? 0);
  const familyContains = (input.family_label_contains as string | undefined)?.trim();
  const needsCeliac = input.needs_celiac_friendly === true;

  const adjustedPersona: Persona = needsCeliac
    ? { ...persona, celiacInFamily: true }
    : persona;

  const ranked = nbs
    .map((nb) => {
      const center = centerById.get(nb.id);
      if (!center) return null;
      const metrics = metricsByNb.get(nb.id);
      const facts = factsFor(nb, metrics, center, pois, schools);
      const breakdown = breakdownFor(facts, adjustedPersona);
      const score = breakdown.reduce((s, r) => s + r.hit, 0);
      return { nb, metrics, facts, score };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => {
      const price = r.metrics?.avg_listing_price ?? 0;
      if (price > 0 && price > maxPrice) return false;
      if (price > 0 && price < minPrice) return false;
      if (familyContains && !(r.nb.family_label ?? "").includes(familyContains)) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const lines = ranked.map((r) => {
    const price = r.metrics?.avg_listing_price ?? 0;
    const pricePart = price ? `, חציון ₪${(price / 1_000_000).toFixed(2)}M` : "";
    const greenPart = r.facts.greenScore ? ` · GS ${r.facts.greenScore}` : "";
    const celiacPart = r.facts.celiacDistance != null ? ` · GF ${Math.round(r.facts.celiacDistance)}m` : "";
    return `- ${r.nb.id} (${r.nb.name_he}): התאמה ${Math.round(r.score)}/100${pricePart}${greenPart}${celiacPart}. ${r.nb.family_label ?? ""}`;
  });

  return {
    content: ranked.length === 0
      ? "לא נמצאו שכונות שמתאימות לסינונים."
      : `נמצאו ${ranked.length} שכונות (ממויינות לפי התאמה לפרסונה הנוכחית):\n${lines.join("\n")}`,
    sources: ["data.gov.il · עסקאות נדל״ן", "OpenStreetMap · POIs", "MishpachaMap match score"],
  };
}

async function compareNeighborhoods(
  sb: SbClient,
  input: Record<string, unknown>,
  persona: Persona,
): Promise<ToolResult> {
  const ids = (input.neighborhood_ids as string[] | undefined) ?? [];
  if (ids.length < 2) return { content: "צריך לפחות שתי שכונות להשוואה." };
  if (ids.length > 4) return { content: "ניתן להשוות עד 4 שכונות בו-זמנית." };

  const { nbs, centerById, metricsByNb, pois, schools } = await loadCorpus(sb);

  const rows = ids.map((id) => {
    const nb = nbs.find((n) => n.id === id || (n.aliases ?? []).some((a) => a.toLowerCase() === id.toLowerCase()));
    if (!nb) return `- ${id}: לא נמצאה שכונה בשם זה.`;
    const center = centerById.get(nb.id);
    if (!center) return `- ${nb.name_he}: חסרים נתוני מיקום.`;
    const metrics = metricsByNb.get(nb.id);
    const facts = factsFor(nb, metrics, center, pois, schools);
    const breakdown = breakdownFor(facts, persona);
    const score = Math.round(breakdown.reduce((s, r) => s + r.hit, 0));
    const price = metrics?.avg_listing_price ?? 0;
    const yoy = metrics?.avg_price_yoy_pct ?? 0;
    return `- ${nb.name_he}: התאמה ${score}/100 · חציון ₪${(price / 1_000_000).toFixed(2)}M (${yoy > 0 ? "+" : ""}${Number(yoy).toFixed(1)}%) · GS ${facts.greenScore} · בית ספר ${facts.schoolWalkMeters ? Math.round(facts.schoolWalkMeters) + "m" : "?"} · פארק ${facts.parkMeters ? Math.round(facts.parkMeters) + "m" : "?"} · GF ${facts.celiacDistance ? Math.round(facts.celiacDistance) + "m" : "אין"}`;
  });

  return {
    content: `השוואה (לפי הפרסונה הנוכחית):\n${rows.join("\n")}`,
    sources: ["data.gov.il", "OpenStreetMap", "MishpachaMap match score"],
  };
}

async function getMatchBreakdown(
  sb: SbClient,
  input: Record<string, unknown>,
  persona: Persona,
): Promise<ToolResult> {
  const id = String(input.neighborhood_id ?? "");
  const { nbs, centerById, metricsByNb, pois, schools } = await loadCorpus(sb);
  const nb = nbs.find((n) => n.id === id || (n.aliases ?? []).some((a) => a.toLowerCase() === id.toLowerCase()));
  if (!nb) return { content: `לא נמצאה שכונה בשם "${id}".` };
  const center = centerById.get(nb.id);
  if (!center) return { content: `לשכונה ${nb.name_he} חסרים נתוני מיקום.` };

  const metrics = metricsByNb.get(nb.id);
  const facts = factsFor(nb, metrics, center, pois, schools);
  const breakdown = breakdownFor(facts, persona);
  const total = Math.round(breakdown.reduce((s, r) => s + r.hit, 0));

  const rows = breakdown.map((r) => `  - ${r.label}: ${r.hit}/${r.weight} משקל`);
  return {
    content: `${nb.name_he} — ציון התאמה כולל ${total}/100\n${rows.join("\n")}`,
    sources: ["MishpachaMap match score · breakdown"],
  };
}

import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateNeighborhoodsFC } from "@/lib/validateNeighborhoods";

export const runtime = "nodejs";

/**
 * Save the polygon editor's working state straight to the source-of-truth file
 * `public/neighborhoods.geo.json` — so a drawing session is never trapped in
 * browser localStorage (which is how hours of work were lost once before).
 *
 * DEV ONLY. It writes to the project filesystem, which is both impossible
 * (read-only) and unsafe on Vercel, so it hard-refuses in production. The
 * `/admin/draw` editor is itself a local-only tool.
 *
 * The payload is validated with the same rules as `npm run polygons:validate`
 * before anything is written, so this can never persist a broken file.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "disabled in production — run the editor locally with npm run dev" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const issues = validateNeighborhoodsFC(body);
  if (issues.length > 0) {
    return NextResponse.json(
      { error: "validation failed — nothing was written", issues },
      { status: 422 },
    );
  }

  const fc = body as GeoJSON.FeatureCollection;
  const path = join(process.cwd(), "public", "neighborhoods.geo.json");
  try {
    await writeFile(path, JSON.stringify(fc, null, 2) + "\n", "utf8");
  } catch (e) {
    return NextResponse.json(
      { error: `could not write file: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    path: "public/neighborhoods.geo.json",
    features: fc.features.length,
    savedAt: new Date().toISOString(),
  });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LeadPayload = {
  kind: "mortgage" | "inspection";
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  /** Context — which neighborhood / listing the lead was interested in. */
  context?: {
    neighborhoodId?: string;
    listingId?: string;
    address?: string;
  };
};

/**
 * V1 stub for the lead-gen KPI hook. Currently logs the lead and returns a
 * success token. Replace the logger with a real handoff to the partner CRM
 * (mortgage broker / home-inspection company) when those partnerships sign.
 *
 * Auth: anon-accessible by design — anyone hitting the map can submit a lead.
 * If we add bot abuse later, swap for a Turnstile / hCaptcha gate.
 */
export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = (await req.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body?.name?.trim() || !body?.phone?.trim()) {
    return NextResponse.json(
      { error: "name and phone are required" },
      { status: 400 },
    );
  }

  if (!["mortgage", "inspection"].includes(body.kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log("[lead-gen]", id, JSON.stringify(body));
  // TODO(post-V1): forward to partner CRM. Suggested integrations:
  //  - mortgage → bank partner / mortgage broker (Bank Hapoalim, Mortgage Israel)
  //  - inspection → "bedek-bayit" company API

  return NextResponse.json({ ok: true, id });
}

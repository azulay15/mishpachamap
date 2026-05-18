/**
 * Simple in-memory rate limiter keyed by IP + bucket name. Per-instance
 * (Vercel serverless instances each have their own map) — fine for V1 abuse
 * prevention against a single client. For distributed throttling, swap for
 * Upstash Redis or Vercel KV.
 *
 * Usage:
 *   const gate = rateLimit(req, "leads", { max: 5, windowMs: 60_000 });
 *   if (!gate.ok) return rateLimitResponse(gate);
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Conservative IP resolution. Vercel sets `x-forwarded-for`; behind other
 * proxies fall back to `x-real-ip`. Last resort is "unknown" so we still
 * rate-limit even when the header chain is missing (one shared bucket for
 * anonymous requests is better than infinite).
 */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export type RateLimitOptions = {
  /** Max requests inside `windowMs`. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

export function rateLimit(
  req: NextRequest,
  bucketName: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const ip = clientIp(req);
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, resetAt: now + opts.windowMs };
  }

  if (existing.count >= opts.max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: opts.max - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Standard 429 response with Retry-After + RateLimit-* headers. */
export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { error: "rate limit exceeded — try again shortly" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
}

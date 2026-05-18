import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { rateLimit } from "./rateLimit";

function reqFromIp(ip: string): NextRequest {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as NextRequest;
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permits up to `max` requests per IP per window", () => {
    const req = reqFromIp("203.0.113.42");
    for (let i = 0; i < 3; i++) {
      const r = rateLimit(req, "test-burst", { max: 3, windowMs: 60_000 });
      expect(r.ok).toBe(true);
    }
    const blocked = rateLimit(req, "test-burst", { max: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("resets after the window elapses", () => {
    const req = reqFromIp("203.0.113.43");
    for (let i = 0; i < 2; i++) rateLimit(req, "test-window", { max: 2, windowMs: 1000 });
    expect(rateLimit(req, "test-window", { max: 2, windowMs: 1000 }).ok).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(rateLimit(req, "test-window", { max: 2, windowMs: 1000 }).ok).toBe(true);
  });

  it("tracks IPs independently", () => {
    const a = reqFromIp("203.0.113.44");
    const b = reqFromIp("203.0.113.45");
    rateLimit(a, "test-iso", { max: 1, windowMs: 60_000 });
    expect(rateLimit(a, "test-iso", { max: 1, windowMs: 60_000 }).ok).toBe(false);
    // Different IP, fresh bucket.
    expect(rateLimit(b, "test-iso", { max: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("falls back to a shared bucket when IP headers are absent", () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    rateLimit(req, "test-anon", { max: 1, windowMs: 60_000 });
    expect(rateLimit(req, "test-anon", { max: 1, windowMs: 60_000 }).ok).toBe(false);
  });
});

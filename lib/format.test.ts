import { describe, expect, it } from "vitest";
import { NIS, NISshort, pct } from "./format";

describe("NIS", () => {
  it("formats with shekel sign and Hebrew thousands separator", () => {
    // he-IL locale uses comma as thousand separator on the result string.
    expect(NIS(1234567)).toBe("₪1,234,567");
  });
  it("rounds to integer", () => {
    expect(NIS(1234.7)).toBe("₪1,235");
  });
  it("handles zero and negatives", () => {
    expect(NIS(0)).toBe("₪0");
    // he-IL inserts a left-to-right mark (U+200E) before negatives.
    expect(NIS(-500).replace(/‎/g, "")).toBe("₪-500");
  });
});

describe("NISshort", () => {
  it("uses M suffix for >= 1M, strips trailing zeros", () => {
    expect(NISshort(4_500_000)).toBe("₪4.5M");
    expect(NISshort(4_000_000)).toBe("₪4M");
    expect(NISshort(4_540_000)).toBe("₪4.54M");
  });
  it("uses K suffix for >= 1K", () => {
    expect(NISshort(12_300)).toBe("₪12K");
  });
  it("passes through small values", () => {
    expect(NISshort(800)).toBe("₪800");
  });
});

describe("pct", () => {
  it("prepends + for positive values", () => {
    expect(pct(3.2)).toBe("+3.2%");
  });
  it("does not prepend + for non-positive", () => {
    expect(pct(0)).toBe("0.0%");
    expect(pct(-1.5)).toBe("-1.5%");
  });
  it("fixes to one decimal", () => {
    expect(pct(2.789)).toBe("+2.8%");
  });
});

import { describe, expect, it } from "vitest";
import { estimateMinutes, findCandidates, haversineKm, pickAlternatives, type IndexNeighborhood } from "./alternatives";

const nb = (id: string, cityId: string, lng: number, lat: number, rent4: number, extra: Partial<IndexNeighborhood> = {}): IndexNeighborhood => ({
  id, he: id, cityId, citySlug: cityId, cityHe: cityId, center: [lng, lat],
  rent: { "4": rent4 }, buy: {}, green: 50, schools: 560, safety: 60, quiet: 50, kids: 30, ...extra,
});

const WORK: [number, number] = [34.79, 32.07];
const home = nb("home", "a", 34.81, 32.07, 7800);
const index = [
  home,
  nb("cheap-better", "b", 34.82, 32.05, 6300, { schools: 590, green: 70 }),
  nb("cheap-worse", "b", 34.8, 32.04, 5200, { schools: 500, green: 10, safety: 20 }),
  nb("barely-cheaper", "a", 34.8, 32.08, 7600),
  nb("pricier", "a", 34.8, 32.09, 9000),
  nb("far", "c", 35.2, 31.78, 5000),
  nb("no-price", "a", 34.8, 32.06, 0, { rent: {} }),
  nb("c1", "b", 34.83, 32.06, 6400),
  nb("c2", "d", 34.78, 32.03, 6500, { schools: 575 }),
];
const q = { home, homePrice: 7800, deal: "rent" as const, rooms: "4" as const, work: WORK, maxMinutes: 25 };

describe("more for less", () => {
  it("measures distance and turns it into rough minutes", () => {
    expect(haversineKm([34.79, 32.07], [34.79, 32.07])).toBe(0);
    expect(Math.round(haversineKm([34.78, 32.08], [35.21, 31.77]))).toBe(53);
    expect(estimateMinutes(0)).toBe(4);
    expect(estimateMinutes(10)).toBe(29);
  });

  it("keeps only cheaper, priced neighborhoods within reach — never home itself", () => {
    const ids = findCandidates(index, q).map((c) => c.nb.id);
    expect(ids).not.toContain("home");
    expect(ids).not.toContain("pricier");
    expect(ids).not.toContain("barely-cheaper"); // saving under the minimum
    expect(ids).not.toContain("far");
    expect(ids).not.toContain("no-price");
    expect(ids).toContain("cheap-better");
  });

  it("reports what is gained or lost against home", () => {
    const c = findCandidates(index, q).find((x) => x.nb.id === "cheap-better")!;
    expect(c.saving).toBe(1500);
    expect(c.deltas.schools).toBe(30);
    expect(c.deltas.green).toBe(20);
  });

  it("prefers a smaller saving with better schools over a bigger one somewhere clearly worse", () => {
    const picks = pickAlternatives(findCandidates(index, q), { homePrice: 7800, maxMinutes: 25 });
    expect(picks[0].nb.id).toBe("cheap-better");
  });

  it("lists places that give nothing up before a bigger saving that does", () => {
    const picks = pickAlternatives(findCandidates(index, q), { homePrice: 7800, maxMinutes: 60, count: 9, perCity: 9 });
    const ids = picks.map((p) => p.nb.id);
    expect(ids.indexOf("cheap-worse")).toBe(ids.length - 1);
  });

  it("drops anything past the commute limit and caps one city at two", () => {
    const cands = findCandidates(index, q).map((c) => (c.nb.id === "c2" ? { ...c, minutes: 40 } : c));
    const picks = pickAlternatives(cands, { homePrice: 7800, maxMinutes: 25 });
    expect(picks.map((p) => p.nb.id)).not.toContain("c2");
    expect(picks.filter((p) => p.nb.cityId === "b").length).toBeLessThanOrEqual(2);
  });

  it("judges only the measures the family chose", () => {
    // With schools / green / safety switched off, the much cheaper place that is
    // worse on all three is no longer held back.
    const metrics = ["quiet" as const];
    const picks = pickAlternatives(findCandidates(index, { ...q, metrics }), { homePrice: 7800, maxMinutes: 60, metrics });
    expect(picks[0].nb.id).toBe("cheap-worse");
    // And a place that is clearly noisier drops behind once quiet is what matters.
    const noisy = index.map((n) => (n.id === "cheap-worse" ? { ...n, quiet: 5 } : n));
    const picks2 = pickAlternatives(findCandidates(noisy, { ...q, metrics }), { homePrice: 7800, maxMinutes: 60, metrics, count: 9, perCity: 9 });
    expect(picks2[picks2.length - 1].nb.id).toBe("cheap-worse");
  });

  it("has no deltas when home is not a neighborhood we cover", () => {
    const c = findCandidates(index, { ...q, home: null })[0];
    expect(c.deltas.schools).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { breakdownFor, scoreColor, totalScore, type NeighborhoodFacts } from "./match";
import { PERSONA_DEFAULT, type Persona } from "./persona";

function fakeFacts(overrides: Partial<NeighborhoodFacts> = {}): NeighborhoodFacts {
  return {
    id: "test",
    avgListing: 4_500_000,
    gardenAvailability: 0.6,
    schoolWalkMeters: 350,
    parkMeters: 250,
    shopMeters: 380,
    transitMeters: 600,
    quietScore: 80,
    greenScore: 75,
    celiacDistance: 600,
    celiacDensity: 3,
    ...overrides,
  };
}

describe("breakdownFor", () => {
  it("returns budget plus must + nice components", () => {
    const rows = breakdownFor(fakeFacts(), PERSONA_DEFAULT);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("תקציב");
    for (const f of PERSONA_DEFAULT.must) expect(labels).toContain(f);
  });

  it("dedups: must wins over nice when both list a feature", () => {
    const persona: Persona = {
      ...PERSONA_DEFAULT,
      must: ["שקט"],
      nice: ["שקט", "תחבורה ציבורית"],
    };
    const rows = breakdownFor(fakeFacts(), persona);
    const quietRows = rows.filter((r) => r.label === "שקט");
    expect(quietRows).toHaveLength(1);
  });

  it("celiacInFamily auto-promotes Celiac-Friendly to a must", () => {
    const persona: Persona = { ...PERSONA_DEFAULT, must: [], nice: [], celiacInFamily: true };
    const rows = breakdownFor(fakeFacts(), persona);
    expect(rows.map((r) => r.label)).toContain("Celiac-Friendly");
  });

  it("weights normalise to ~100", () => {
    const rows = breakdownFor(fakeFacts(), PERSONA_DEFAULT);
    const sum = rows.reduce((s, r) => s + r.weight, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it("hit never exceeds the component's weight", () => {
    const rows = breakdownFor(fakeFacts(), PERSONA_DEFAULT);
    for (const r of rows) expect(r.hit).toBeLessThanOrEqual(r.weight);
  });

  it("budget out of range with no slack lands at 0", () => {
    const persona: Persona = { ...PERSONA_DEFAULT, must: [], nice: [], budget: { min: 1_000_000, max: 1_100_000 } };
    const rows = breakdownFor(fakeFacts({ avgListing: 10_000_000 }), persona);
    const budget = rows.find((r) => r.label === "תקציב");
    expect(budget?.hit).toBe(0);
  });

  it("perfect walking distance to school yields full hit", () => {
    const persona: Persona = { ...PERSONA_DEFAULT, must: ["בית ספר במרחק הליכה"], nice: [] };
    const rows = breakdownFor(fakeFacts({ schoolWalkMeters: 200 }), persona);
    const school = rows.find((r) => r.label === "בית ספר במרחק הליכה")!;
    expect(school.hit).toBe(school.weight);
  });
});

describe("totalScore", () => {
  it("sums hits across rows", () => {
    const rows = [
      { label: "a", weight: 50, hit: 40 },
      { label: "b", weight: 50, hit: 35 },
    ];
    expect(totalScore(rows)).toBe(75);
  });
});

describe("scoreColor", () => {
  it("buckets by threshold", () => {
    expect(scoreColor(95)).toBe("var(--green-positive)");
    expect(scoreColor(85)).toBe("var(--pumpkin-orange)");
    expect(scoreColor(70)).toBe("var(--grey-700)");
  });
});

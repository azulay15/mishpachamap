import { describe, expect, it } from "vitest";
import { filterPrice, hasDeal, marketPrice, passesFilter, priceForSizes, priceLabel, roomKeysForRange, type Market } from "./market";
import { breakdownFor, budgetPrice, type NeighborhoodFacts } from "./match";
import { PERSONA_DEFAULT } from "./persona";

const market: Market = {
  rent: { "3": 5500, "4": 7000, all: 6800 },
  buy: { "4": 3_200_000, all: 2_900_000 },
  rentChangePct: 2.1,
  yieldPct: 2.9,
};

describe("market prices", () => {
  it("reads a figure, and null when the source has none", () => {
    expect(marketPrice(market, "rent", "4")).toBe(7000);
    expect(marketPrice(market, "rent", "5")).toBeNull();
    expect(marketPrice(null, "buy", "all")).toBeNull();
  });

  it("clamps a room range to the published sizes", () => {
    expect(roomKeysForRange(4, 5)).toEqual(["4", "5"]);
    expect(roomKeysForRange(1, 2)).toEqual(["3"]);
    expect(roomKeysForRange(6, 8)).toEqual(["5"]);
    expect(roomKeysForRange(5, 3)).toEqual(["3", "4", "5"]);
  });

  it("averages the sizes that have a figure, then falls back to all sizes", () => {
    expect(priceForSizes(market, "rent", ["3", "4"])).toBe(6250);
    expect(priceForSizes(market, "rent", ["4", "5"])).toBe(7000);
    expect(priceForSizes(market, "rent", ["5"])).toBe(6800);
    expect(priceForSizes(market, "rent", ["5"], false)).toBeNull();
  });

  it("uses the overall sale price for buy + all sizes, by-size figures otherwise", () => {
    const n = { avgListing: 3_050_000, market };
    expect(filterPrice(n, { deal: "buy", rooms: "all" })).toBe(3_050_000);
    expect(filterPrice({ avgListing: 0, market }, { deal: "buy", rooms: "all" })).toBe(2_900_000);
    expect(filterPrice(n, { deal: "buy", rooms: "4" })).toBe(3_200_000);
    expect(filterPrice(n, { deal: "rent", rooms: "5" })).toBeNull();
  });

  it("a ceiling rules out pricier neighborhoods and ones with no figure", () => {
    expect(passesFilter(7000, { max: null })).toBe(true);
    expect(passesFilter(null, { max: null })).toBe(true);
    expect(passesFilter(7000, { max: 7000 })).toBe(true);
    expect(passesFilter(7010, { max: 7000 })).toBe(false);
    expect(passesFilter(null, { max: 7000 })).toBe(false);
  });

  it("knows which deal types a city has", () => {
    expect(hasDeal([{ avgListing: 0, market: null }], "buy")).toBe(false);
    expect(hasDeal([{ avgListing: 0, market }], "rent")).toBe(true);
    expect(hasDeal([{ avgListing: 2_000_000, market: null }], "buy")).toBe(true);
  });

  it("formats rent and sale prices", () => {
    expect(priceLabel(7800, "rent")).toBe("₪7,800");
    expect(priceLabel(3_200_000, "buy")).toBe("₪3.2M");
    expect(priceLabel(3_000_000, "buy")).toBe("₪3M");
    expect(priceLabel(950_000, "buy")).toBe("₪950K");
  });
});

describe("budget scoring with rent", () => {
  const facts: NeighborhoodFacts = {
    id: "t", avgListing: 9_000_000, market, gardenAvailability: 0.5, schoolWalkMeters: 300, parkMeters: 200,
    shopMeters: 300, transitMeters: 400, quietScore: 70, greenScore: 70, celiacDistance: null, celiacDensity: 0,
  };
  const renter = { ...PERSONA_DEFAULT, deal: "rent" as const, rentBudget: { min: 6000, max: 7500 }, rooms: { min: 4, max: 4 } };

  it("judges a renter by the rent for their room count, not the sale price", () => {
    expect(budgetPrice(facts, renter)).toBe(7000);
    const budget = breakdownFor(facts, renter).find((r) => r.label === "תקציב")!;
    expect(budget.hit).toBe(budget.weight);
  });

  it("judges a buyer by the sale price for their room count when there is one", () => {
    const buyer = { ...PERSONA_DEFAULT, rooms: { min: 4, max: 4 } };
    expect(budgetPrice(facts, buyer)).toBe(3_200_000);
    expect(budgetPrice({ ...facts, market: null }, buyer)).toBe(9_000_000);
  });

  it("scores rent well above the band as a miss", () => {
    const cheap = { ...renter, rentBudget: { min: 3000, max: 4000 } };
    const budget = breakdownFor(facts, cheap).find((r) => r.label === "תקציב")!;
    expect(budget.hit).toBe(0);
  });
});

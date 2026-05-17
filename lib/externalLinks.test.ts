import { describe, expect, it } from "vitest";
import {
  externalSearchUrls,
  madlanSearchUrl,
  nadlanGovSearchUrl,
  yad2SearchUrl,
} from "./externalLinks";

describe("yad2SearchUrl", () => {
  it("hits the Modi'in city filter and percent-encodes Hebrew", () => {
    const url = yad2SearchUrl("בוכמן");
    expect(url).toContain("city=1200");
    expect(url).toContain(encodeURIComponent("בוכמן"));
    expect(url.startsWith("https://www.yad2.co.il/")).toBe(true);
  });
});

describe("madlanSearchUrl", () => {
  it("appends Modi'in to the query and url-encodes", () => {
    const url = madlanSearchUrl("הכרמים");
    expect(url).toContain(encodeURIComponent("הכרמים, מודיעין"));
    expect(url.startsWith("https://www.madlan.co.il/")).toBe(true);
  });
});

describe("nadlanGovSearchUrl", () => {
  it("appends the full municipality name", () => {
    const url = nadlanGovSearchUrl("הכרמים");
    expect(url).toContain(encodeURIComponent("הכרמים מודיעין-מכבים-רעות"));
    expect(url.startsWith("https://www.nadlan.gov.il/")).toBe(true);
  });
});

describe("externalSearchUrls", () => {
  it("returns all three sites as a record", () => {
    const urls = externalSearchUrls("הכרמים");
    expect(Object.keys(urls).sort()).toEqual(["madlan", "nadlan", "yad2"]);
    expect(urls.yad2).toBe(yad2SearchUrl("הכרמים"));
    expect(urls.madlan).toBe(madlanSearchUrl("הכרמים"));
    expect(urls.nadlan).toBe(nadlanGovSearchUrl("הכרמים"));
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FALLBACK, scoreStep, token } from "./theme";

/** The light :root block of hanachala.css (the first one in the file). */
function lightTokens(): Record<string, string> {
  const css = readFileSync(resolve(__dirname, "../styles/hanachala.css"), "utf8");
  const block = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--hn-[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

describe("theme tokens", () => {
  it("FALLBACK matches styles/hanachala.css", () => {
    const css = lightTokens();
    for (const [name, value] of Object.entries(FALLBACK)) {
      expect(css[name], name).toBeDefined();
      expect(css[name].toUpperCase(), name).toBe(value.toUpperCase());
    }
  });

  it("every FALLBACK value is a 6-digit hex (popups append an alpha suffix)", () => {
    for (const v of Object.values(FALLBACK)) expect(v).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("token() returns the fallback outside the browser", () => {
    expect(token("--hn-accent")).toBe("#EF6A1B");
  });

  it("scoreStep buckets match scores for the map ramp", () => {
    expect(scoreStep(84)).toBe(5);
    expect(scoreStep(80)).toBe(5);
    expect(scoreStep(74)).toBe(4);
    expect(scoreStep(61)).toBe(3);
    expect(scoreStep(57)).toBe(2);
    expect(scoreStep(49)).toBe(1);
  });
});

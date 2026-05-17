import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple header + body", () => {
    expect(parseCsv("a,b,c\n1,2,3\n4,5,6")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('a,b\n"hello, world",x')).toEqual([
      ["a", "b"],
      ["hello, world", "x"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([
      ["a"],
      ['she said "hi"'],
    ]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("normalises CRLF and LF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserves Hebrew + numeric content verbatim", () => {
    expect(parseCsv('שכונה,מחיר\nהכרמים,1234567')).toEqual([
      ["שכונה", "מחיר"],
      ["הכרמים", "1234567"],
    ]);
  });

  it("handles trailing row without terminator", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

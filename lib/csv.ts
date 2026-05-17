/**
 * Minimal CSV parser. Handles quoted fields ("a,b","c"), escaped quotes
 * (""), and CRLF/LF line endings. Strips a leading UTF-8 BOM if present.
 * Not RFC 4180 complete (no streaming, no header inference) — sufficient
 * for the known-good government exports we're targeting in nadlan_csv.ts.
 */
export function parseCsv(input: string): string[][] {
  let i = 0;
  const len = input.length;
  if (len > 0 && input.charCodeAt(0) === 0xfeff) i = 1; // BOM
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      out.push(row);
      row = [];
      if (ch === "\r" && input[i + 1] === "\n") i += 2;
      else i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

export const NIS = (n: number): string =>
  "₪" + Math.round(n).toLocaleString("he-IL");

export const NISshort = (n: number): string => {
  if (n >= 1_000_000) return "₪" + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1_000) return "₪" + Math.round(n / 1_000) + "K";
  return "₪" + n;
};

export const pct = (n: number): string => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

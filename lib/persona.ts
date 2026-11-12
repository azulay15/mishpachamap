export type Persona = {
  name: string;
  size: number;
  kids: { age: number; label: string }[];
  /** Looking to buy or to rent. Decides which budget + prices the match uses. */
  deal: "buy" | "rent";
  /** Purchase budget, NIS. */
  budget: { min: number; max: number };
  /** Monthly rent budget, NIS. Used when `deal` is "rent". */
  rentBudget: { min: number; max: number };
  rooms: { min: number; max: number };
  must: string[];
  nice: string[];
  /** Dietary: family member with Celiac disease. Flips the celiac proximity
   *  signal from "ignored" to a real component in the match score. */
  celiacInFamily?: boolean;
};

export const PERSONA_DEFAULT: Persona = {
  name: "משפחת לוי",
  size: 4,
  kids: [
    { age: 9, label: "כיתה ד׳" },
    { age: 6, label: "כיתה א׳" },
  ],
  deal: "buy",
  budget: { min: 3_500_000, max: 5_200_000 },
  rentBudget: { min: 5_500, max: 8_500 },
  rooms: { min: 4, max: 5 },
  must: ["גינה צמודה", "בית ספר במרחק הליכה", "פארק קרוב", "מכולת/מרכול"],
  nice: ["שקט", "תחבורה ציבורית", "קהילה דתית-לאומית"],
};

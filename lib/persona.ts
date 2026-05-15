export type Persona = {
  name: string;
  size: number;
  kids: { age: number; label: string }[];
  budget: { min: number; max: number };
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
  budget: { min: 3_500_000, max: 5_200_000 },
  rooms: { min: 4, max: 5 },
  must: ["גינה צמודה", "בית ספר במרחק הליכה", "פארק קרוב", "מכולת/מרכול"],
  nice: ["שקט", "תחבורה ציבורית", "קהילה דתית-לאומית"],
};

"use client";

import { useEffect, useState } from "react";
import { PERSONA_DEFAULT, type Persona } from "./persona";

const KEY = "mishpachamap.persona.v1";

function read(): Persona {
  if (typeof window === "undefined") return PERSONA_DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return PERSONA_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Persona>;
    // Shallow merge so future-added fields fall back to defaults.
    return { ...PERSONA_DEFAULT, ...parsed };
  } catch {
    return PERSONA_DEFAULT;
  }
}

export function writePersona(p: Persona): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("mishpachamap.persona.change"));
}

export function resetPersona(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("mishpachamap.persona.change"));
}

/**
 * Read persona from localStorage with reactive updates. SSR returns the default.
 * Components using this hook will re-render whenever `writePersona` is called.
 */
export function usePersona(): Persona {
  // Always render with the default on the server to avoid hydration mismatch.
  const [persona, setPersona] = useState<Persona>(PERSONA_DEFAULT);

  useEffect(() => {
    setPersona(read());
    const handler = () => setPersona(read());
    window.addEventListener("mishpachamap.persona.change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("mishpachamap.persona.change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return persona;
}

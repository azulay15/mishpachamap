"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "mishpachamap.favorites.v1";
const EVENT = "mishpachamap.favorites.change";

export type Favorites = {
  neighborhoods: string[];
  listings: string[];
};

const EMPTY: Favorites = { neighborhoods: [], listings: [] };

function read(): Favorites {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Favorites>;
    return {
      neighborhoods: parsed.neighborhoods ?? [],
      listings: parsed.listings ?? [],
    };
  } catch {
    return EMPTY;
  }
}

function write(next: Favorites) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function useFavorites() {
  const [favs, setFavs] = useState<Favorites>(EMPTY);

  useEffect(() => {
    setFavs(read());
    const handler = () => setFavs(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const toggleNeighborhood = useCallback((id: string) => {
    const current = read();
    const has = current.neighborhoods.includes(id);
    write({
      ...current,
      neighborhoods: has
        ? current.neighborhoods.filter((x) => x !== id)
        : [...current.neighborhoods, id],
    });
  }, []);

  const toggleListing = useCallback((id: string) => {
    const current = read();
    const has = current.listings.includes(id);
    write({
      ...current,
      listings: has ? current.listings.filter((x) => x !== id) : [...current.listings, id],
    });
  }, []);

  const hasNeighborhood = useCallback((id: string) => favs.neighborhoods.includes(id), [favs]);
  const hasListing = useCallback((id: string) => favs.listings.includes(id), [favs]);

  const count = favs.neighborhoods.length + favs.listings.length;

  return { favs, count, hasNeighborhood, hasListing, toggleNeighborhood, toggleListing };
}

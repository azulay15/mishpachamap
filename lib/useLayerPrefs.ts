"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LAYERS, type LayerId } from "./layers";

const KEY = "mishpachamap.layers.v1";

const VALID_IDS = new Set<LayerId>(LAYERS.map((l) => l.id));

function read(defaults: LayerId[]): Set<LayerId> {
  if (typeof window === "undefined") return new Set(defaults);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set(defaults);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(defaults);
    const filtered = parsed.filter((id): id is LayerId => typeof id === "string" && VALID_IDS.has(id as LayerId));
    return new Set(filtered);
  } catch {
    return new Set(defaults);
  }
}

/**
 * Map-layer toggle state, persisted to localStorage so the user's preferred
 * map view survives reloads. Starts from `defaults` until the client-side
 * effect hydrates the persisted value (avoiding SSR/CSR mismatch).
 */
export function useLayerPrefs(defaults: LayerId[]) {
  const [layers, setLayers] = useState<Set<LayerId>>(() => new Set(defaults));
  const hydratedRef = useRef(false);

  useEffect(() => {
    setLayers(read(defaults));
    hydratedRef.current = true;
    // defaults are conceptually constant per page; we only want to re-read
    // localStorage on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(Array.from(layers)));
    } catch {
      /* localStorage full / disabled — non-fatal */
    }
  }, [layers]);

  const toggle = useCallback((id: LayerId) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { layers, setLayers, toggle };
}

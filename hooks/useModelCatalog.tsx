"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODELS, fetchSupabaseSeed } from "@/lib/models-catalog";
import type { CatalogModel } from "@/lib/types";

export const MODELS_KEY = "vok.models.v1";

/**
 * null = todavia no se sembro (primer arranque); [] = el usuario lo vacio a proposito.
 * Esta distincion es critica: el efecto de siembra desde Supabase solo dispara con
 * `null` estricto, nunca con un catalogo vacio por eleccion del usuario.
 */
function readCatalog(): CatalogModel[] | null {
  try {
    const raw = localStorage.getItem(MODELS_KEY);
    return raw === null ? null : (JSON.parse(raw) as CatalogModel[]);
  } catch {
    return null;
  }
}

function writeCatalog(list: CatalogModel[]) {
  try {
    localStorage.setItem(MODELS_KEY, JSON.stringify(list));
  } catch {
    // cuota excedida u otro fallo de storage
  }
}

interface ModelCatalogContextValue {
  catalog: CatalogModel[];
  rawCatalog: CatalogModel[] | null;
  addModel: (m: Omit<CatalogModel, "id">) => void;
  removeModel: (id: string) => void;
  resetToDefaults: () => void;
  hydrated: boolean;
}

const ModelCatalogContext = React.createContext<ModelCatalogContextValue | null>(null);

export function ModelCatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalogState] = useState<CatalogModel[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    // Sincroniza con localStorage (sistema externo) tras el primer render — patrón de
    // hidratación SSR-safe, no un anti-patrón.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCatalogState(readCatalog());
    setHydrated(true);
  }, []);

  const setCatalog = useCallback((list: CatalogModel[]) => {
    writeCatalog(list);
    setCatalogState(list);
  }, []);

  useEffect(() => {
    if (!hydrated || seeded.current) return;
    if (catalog !== null) return;
    seeded.current = true;
    (async () => {
      try {
        const seed = await fetchSupabaseSeed();
        setCatalog(seed);
      } catch {
        setCatalog(DEFAULT_MODELS.map((m) => ({ ...m })));
      }
    })();
  }, [hydrated, catalog, setCatalog]);

  const addModel = useCallback(
    (m: Omit<CatalogModel, "id">) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      setCatalog([...(catalog || []), { ...m, id }]);
    },
    [catalog, setCatalog],
  );

  const removeModel = useCallback(
    (id: string) => setCatalog((catalog || []).filter((m) => m.id !== id)),
    [catalog, setCatalog],
  );

  const resetToDefaults = useCallback(() => setCatalog(DEFAULT_MODELS.map((m) => ({ ...m }))), [setCatalog]);

  const value = React.useMemo(
    () => ({ catalog: catalog || [], rawCatalog: catalog, addModel, removeModel, resetToDefaults, hydrated }),
    [catalog, addModel, removeModel, resetToDefaults, hydrated],
  );

  return <ModelCatalogContext.Provider value={value}>{children}</ModelCatalogContext.Provider>;
}

export function useModelCatalog(): ModelCatalogContextValue {
  const ctx = React.useContext(ModelCatalogContext);
  if (!ctx) throw new Error("useModelCatalog must be used within a ModelCatalogProvider");
  return ctx;
}

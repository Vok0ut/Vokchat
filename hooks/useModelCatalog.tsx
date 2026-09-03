"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODELS, fetchSupabaseSeed } from "@/lib/models-catalog";
import { CFG_KEY } from "@/hooks/useSettings";
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
  updateModel: (id: string, patch: Partial<Omit<CatalogModel, "id">>) => void;
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

  const backfilled = useRef(false);
  useEffect(() => {
    // Migración única: usuarios con la antigua clave global (`nimchat.cfg.v1.nimKey`,
    // de antes de que cada modelo tuviera su propia clave) la heredan como clave de
    // arranque en los modelos que aún no tengan una propia — nunca sobrescribe una
    // clave que el usuario ya haya puesto por modelo. Lee localStorage directamente
    // (en vez de useSettings()) para no depender del orden de providers.
    if (!hydrated || backfilled.current || catalog === null) return;
    backfilled.current = true;
    let legacyKey = "";
    try {
      const raw = localStorage.getItem(CFG_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      legacyKey = typeof parsed?.nimKey === "string" ? parsed.nimKey : "";
    } catch {
      // localStorage inaccesible o JSON inválido — se ignora, sin migración
    }
    if (!legacyKey) return;
    if (!catalog.some((m) => !m.apiKey)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCatalog(catalog.map((m) => (m.apiKey ? m : { ...m, apiKey: legacyKey })));
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

  const updateModel = useCallback(
    (id: string, patch: Partial<Omit<CatalogModel, "id">>) =>
      setCatalog((catalog || []).map((m) => (m.id === id ? { ...m, ...patch } : m))),
    [catalog, setCatalog],
  );

  const resetToDefaults = useCallback(() => setCatalog(DEFAULT_MODELS.map((m) => ({ ...m }))), [setCatalog]);

  const value = React.useMemo(
    () => ({
      catalog: catalog || [],
      rawCatalog: catalog,
      addModel,
      removeModel,
      updateModel,
      resetToDefaults,
      hydrated,
    }),
    [catalog, addModel, removeModel, updateModel, resetToDefaults, hydrated],
  );

  return <ModelCatalogContext.Provider value={value}>{children}</ModelCatalogContext.Provider>;
}

export function useModelCatalog(): ModelCatalogContextValue {
  const ctx = React.useContext(ModelCatalogContext);
  if (!ctx) throw new Error("useModelCatalog must be used within a ModelCatalogProvider");
  return ctx;
}

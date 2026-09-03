"use client";

import * as React from "react";
import { useCallback } from "react";
import { useLocalStorageStore } from "./useLocalStorageStore";
import type { Settings } from "@/lib/types";

export const CFG_KEY = "nimchat.cfg.v1";

export const DEFAULT_SETTINGS: Settings = {
  model: "",
  proxy: "",
  systemPrompt: "",
  temperature: 0.6,
  maxTokens: null,
  ghToken: "",
  bridgeUrl: "",
  bridgeToken: "",
};

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  wipeSettings: () => void;
  hydrated: boolean;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

/**
 * Fuente única de `nimchat.cfg.v1`, compartida vía Context. Debe usarse UNA sola vez
 * (aquí) — si cada componente llamara useLocalStorageStore por su cuenta, cada uno
 * tendría su propia copia de estado desincronizada del resto (guardar Ajustes en un
 * sitio no se reflejaría en otro, p. ej. en useChat).
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings, hydrated] = useLocalStorageStore<Settings>(CFG_KEY, DEFAULT_SETTINGS);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  const wipeSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  const value = React.useMemo(
    () => ({ settings, updateSettings, wipeSettings, hydrated }),
    [settings, updateSettings, wipeSettings, hydrated],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}

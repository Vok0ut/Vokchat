"use client";

import * as React from "react";
import { useCallback, useEffect } from "react";
import { useLocalStorageStore } from "./useLocalStorageStore";

export const APPEARANCE_KEY = "vok.appearance.v1";

interface Appearance {
  accent: string | null;
  backgroundImage: string | null;
}

const DEFAULT_APPEARANCE: Appearance = { accent: null, backgroundImage: null };

/** Calcula un color de texto legible (blanco o casi-negro) para un fondo dado. */
function idealForeground(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#0a0a0a" : "#ffffff";
}

interface AppearanceContextValue {
  accent: string | null;
  backgroundImage: string | null;
  setAccent: (accent: string | null) => void;
  setBackgroundImage: (backgroundImage: string | null) => void;
  hydrated: boolean;
}

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance, hydrated] = useLocalStorageStore<Appearance>(
    APPEARANCE_KEY,
    DEFAULT_APPEARANCE,
  );

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement.style;
    if (appearance.accent) {
      root.setProperty("--primary", appearance.accent);
      root.setProperty("--primary-foreground", idealForeground(appearance.accent));
    } else {
      root.removeProperty("--primary");
      root.removeProperty("--primary-foreground");
    }
  }, [appearance.accent, hydrated]);

  const setAccent = useCallback(
    (accent: string | null) => setAppearance((prev) => ({ ...prev, accent })),
    [setAppearance],
  );
  const setBackgroundImage = useCallback(
    (backgroundImage: string | null) => setAppearance((prev) => ({ ...prev, backgroundImage })),
    [setAppearance],
  );

  const value = React.useMemo(
    () => ({
      accent: appearance.accent,
      backgroundImage: appearance.backgroundImage,
      setAccent,
      setBackgroundImage,
      hydrated,
    }),
    [appearance.accent, appearance.backgroundImage, setAccent, setBackgroundImage, hydrated],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = React.useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within an AppearanceProvider");
  return ctx;
}

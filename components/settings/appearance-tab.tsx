"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppearance } from "@/hooks/useAppearance";

const PRESET_ACCENTS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#9333ea", "#0891b2"];

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAppearance();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Modo de color</Label>
        <div className="flex gap-2">
          <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")} className="flex-1 gap-1.5">
            <Sun className="size-3.5" /> Claro
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")} className="flex-1 gap-1.5">
            <Moon className="size-3.5" /> Oscuro
          </Button>
          <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")} className="flex-1">
            Sistema
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Color de acento</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-label={`Usar acento ${c}`}
              className="size-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: accent === c ? c : "transparent" }}
            />
          ))}
          <input
            type="color"
            value={accent || "#2563eb"}
            onChange={(e) => setAccent(e.target.value)}
            className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
            aria-label="Color de acento personalizado"
          />
          {accent && (
            <Button variant="ghost" size="sm" onClick={() => setAccent(null)}>
              Restablecer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

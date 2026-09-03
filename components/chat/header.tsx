"use client";

import { History, Moon, Plus, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ModelQuickPicker } from "./model-quick-picker";
import type { CatalogModel } from "@/lib/types";

export function Header({
  catalog,
  activeModelId,
  onSelectModel,
  onOpenHistory,
  onOpenSettings,
  onNewConversation,
}: {
  catalog: CatalogModel[];
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onNewConversation: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-3 py-2 backdrop-filter backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-sm font-semibold tracking-tight">Vok Chat</span>
        <ModelQuickPicker catalog={catalog} activeModelId={activeModelId} onSelect={onSelectModel} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Cambiar tema"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Conversaciones" onClick={onOpenHistory}>
          <History className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Nueva conversación" onClick={onNewConversation}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Ajustes" onClick={onOpenSettings}>
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}

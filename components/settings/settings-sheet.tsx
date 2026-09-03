"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppearanceTab } from "./appearance-tab";
import { ModelTab } from "./model-tab";
import { ModelsTab } from "./models-tab";
import { GithubTab } from "./github-tab";
import { BrowserTab } from "./browser-tab";
import { useSettings, DEFAULT_SETTINGS } from "@/hooks/useSettings";
import { useConfirm } from "@/hooks/useConfirm";
import { invalidateBridgeToolsCache } from "@/lib/bridge";
import type { Settings } from "@/lib/types";

export function SettingsSheet({
  open,
  onOpenChange,
  initialTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}) {
  const { settings, updateSettings, wipeSettings } = useSettings();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Settings>(settings);

  useEffect(() => {
    // Reinicia el borrador local desde la fuente compartida cada vez que se abre la
    // hoja — sincroniza con el sistema externo (Context de ajustes), no deriva de props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (p: Partial<Settings>) => setDraft((prev) => ({ ...prev, ...p }));

  const save = () => {
    updateSettings(draft);
    invalidateBridgeToolsCache();
    onOpenChange(false);
  };

  const wipe = async () => {
    const ok = await confirm({
      title: "¿Borrar todas las claves?",
      description: "Se borrarán todas las claves guardadas en este dispositivo.",
      destructive: true,
    });
    if (!ok) return;
    wipeSettings();
    setDraft(DEFAULT_SETTINGS);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88vh] flex-col rounded-t-3xl p-0">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle>Ajustes</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue={initialTab || "apariencia"} className="flex min-h-0 flex-1 flex-col px-5">
          <TabsList className="grid w-full grid-cols-5 text-[11px]">
            <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
            <TabsTrigger value="modelo">Modelo</TabsTrigger>
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="navegador">Navegador</TabsTrigger>
          </TabsList>
          <div className="prompt-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pb-4">
            <TabsContent value="apariencia">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="modelo">
              <ModelTab draft={draft} patch={patch} />
            </TabsContent>
            <TabsContent value="modelos">
              <ModelsTab />
            </TabsContent>
            <TabsContent value="github">
              <GithubTab draft={draft} patch={patch} />
            </TabsContent>
            <TabsContent value="navegador">
              <BrowserTab draft={draft} patch={patch} />
            </TabsContent>
          </div>
        </Tabs>
        <div className="flex flex-col gap-2 border-t bg-background/95 p-4 backdrop-blur">
          <Button onClick={save}>Guardar claves</Button>
          <Button variant="outline" onClick={wipe}>
            Borrar claves de este dispositivo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

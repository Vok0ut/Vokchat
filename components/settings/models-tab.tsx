"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useConfirm } from "@/hooks/useConfirm";
import { MODEL_CATEGORIES } from "@/lib/models-catalog";
import type { ModelCategory } from "@/lib/types";

const CATEGORIES: ModelCategory[] = ["codigo", "razonamiento", "imagen"];

export function ModelsTab() {
  const { catalog, addModel, removeModel, resetToDefaults } = useModelCatalog();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [category, setCategory] = useState<ModelCategory>("codigo");

  const handleAdd = () => {
    if (!name.trim() || !modelId.trim()) {
      alert("Completa nombre e ID del modelo.");
      return;
    }
    addModel({ name: name.trim(), modelId: modelId.trim(), category });
    setName("");
    setModelId("");
  };

  const handleRemove = async (id: string, label: string) => {
    const ok = await confirm({ title: "¿Borrar modelo?", description: `¿Borrar «${label}» del catálogo?`, destructive: true });
    if (ok) removeModel(id);
  };

  const handleReset = async () => {
    const ok = await confirm({ title: "¿Restaurar valores por defecto?", description: "Se reemplazará tu catálogo actual por los 3 modelos por defecto." });
    if (ok) resetToDefaults();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Catálogo</div>
        <p className="text-xs text-muted-foreground">
          Modelos disponibles en la pestaña «Modelo» y en el selector rápido de la cabecera. Se guarda solo en
          este dispositivo; la primera vez se siembra desde una tabla pública de solo lectura.
        </p>
        {catalog.length === 0 && <p className="text-sm text-muted-foreground">No hay modelos en el catálogo.</p>}
        <div className="flex flex-col divide-y">
          {catalog.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{m.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {m.modelId} · {MODEL_CATEGORIES[m.category]}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(m.id, m.name)} aria-label="Borrar modelo del catálogo">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Añadir modelo</div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newModelName">Nombre</Label>
          <Input id="newModelName" placeholder="p. ej. Kimi K3" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newModelId">ID del modelo (NIM)</Label>
          <Input id="newModelId" placeholder="p. ej. moonshotai/kimi-k2-instruct" value={modelId} onChange={(e) => setModelId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Categoría</Label>
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <Button key={c} type="button" size="sm" variant={category === c ? "default" : "outline"} className="flex-1" onClick={() => setCategory(c)}>
                {MODEL_CATEGORIES[c]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Los modelos de categoría «Imagen» generan una imagen en vez de responder con texto.</p>
        </div>
        <Button onClick={handleAdd}>Añadir modelo</Button>
      </div>

      <Button variant="outline" onClick={handleReset}>
        Restaurar valores por defecto
      </Button>
    </div>
  );
}

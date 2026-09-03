"use client";

import { Check, ChevronDown, Code2, ImageIcon, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MODEL_CATEGORIES } from "@/lib/models-catalog";
import type { CatalogModel, ModelCategory } from "@/lib/types";

const CATEGORY_ICON: Record<ModelCategory, typeof Code2> = {
  codigo: Code2,
  razonamiento: Sparkles,
  imagen: ImageIcon,
};

export function ModelQuickPicker({
  catalog,
  activeModelId,
  onSelect,
}: {
  catalog: CatalogModel[];
  activeModelId: string;
  onSelect: (modelId: string) => void;
}) {
  const active = catalog.find((m) => m.modelId === activeModelId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Elegir modelo"
          className="flex max-w-[45vw] items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="truncate">{active ? active.name : activeModelId || "Sin modelo"}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {catalog.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Tu catálogo está vacío. Añade modelos en Ajustes → Modelos.
          </div>
        )}
        {catalog.map((m) => {
          const Icon = CATEGORY_ICON[m.category];
          const isActive = m.modelId === activeModelId;
          return (
            <DropdownMenuItem key={m.id} onSelect={() => onSelect(m.modelId)} className="flex flex-col items-start gap-0.5 py-2">
              <span className="flex w-full items-center gap-2 text-sm">
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{m.name}</span>
                {isActive && <Check className="size-3.5 text-primary" />}
              </span>
              <span className="truncate pl-5.5 text-[10.5px] text-muted-foreground">
                {m.modelId} · {MODEL_CATEGORIES[m.category]}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

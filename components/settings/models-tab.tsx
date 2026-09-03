"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useConfirm } from "@/hooks/useConfirm";
import { MODEL_CATEGORIES } from "@/lib/models-catalog";
import type { ModelCategory, Settings } from "@/lib/types";

const CATEGORIES: ModelCategory[] = ["codigo", "razonamiento", "imagen"];

const WORKER_CODE = `export default {
  async fetch(req) {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: cors() });
    const inUrl = new URL(req.url);
    const url = "https://integrate.api.nvidia.com" + inUrl.pathname + inUrl.search;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("Authorization") || ""
      },
      body: req.body
    });
    const res = new Response(r.body, r);
    Object.entries(cors()).forEach(([k,v]) => res.headers.set(k,v));
    return res;
  }
};
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}`;

export function ModelsTab({ draft, patch }: { draft: Settings; patch: (p: Partial<Settings>) => void }) {
  const { catalog, addModel, removeModel, updateModel, resetToDefaults } = useModelCatalog();
  const confirm = useConfirm();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [category, setCategory] = useState<ModelCategory>("codigo");

  const handleAdd = () => {
    if (!name.trim() || !modelId.trim() || !apiKey.trim()) {
      alert("Completa nombre, ID del modelo y clave API.");
      return;
    }
    addModel({ name: name.trim(), modelId: modelId.trim(), apiKey: apiKey.trim(), category });
    setName("");
    setModelId("");
    setApiKey("");
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
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Proxy</div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proxy">Proxy CORS · necesario para NIM</Label>
          <Input id="proxy" type="url" placeholder="https://tu-worker.workers.dev" autoComplete="off" value={draft.proxy} onChange={(e) => patch({ proxy: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            La API de NVIDIA no permite llamadas directas desde el navegador. Despliega el mini-proxy de abajo
            (Cloudflare Worker gratis) y pega aquí su URL. Se comparte entre todos los modelos del catálogo.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="text-left text-xs font-medium text-muted-foreground">
          {advancedOpen ? "[-]" : "[+]"} Parámetros avanzados
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-4 rounded-2xl border p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="systemPrompt">Prompt de sistema personalizado</Label>
              <Textarea
                id="systemPrompt"
                rows={3}
                placeholder="Dejar vacío para usar el prompt por defecto…"
                value={draft.systemPrompt}
                onChange={(e) => patch({ systemPrompt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Sustituye por completo las instrucciones internas del asistente.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxTokens">Tokens máximos de respuesta</Label>
              <Input
                id="maxTokens"
                type="text"
                inputMode="numeric"
                placeholder="2048"
                autoComplete="off"
                value={draft.maxTokens ?? ""}
                onChange={(e) => patch({ maxTokens: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setWorkerOpen((v) => !v)} className="text-left text-xs font-medium text-muted-foreground">
          {workerOpen ? "[-]" : "[+]"} Código del proxy · Cloudflare Worker
        </button>
        {workerOpen && (
          <div className="flex flex-col gap-2 rounded-2xl border p-4">
            <p className="text-xs text-muted-foreground">
              Reenvía la ruta entrante, así sirve tanto <code>/v1/chat/completions</code> como{" "}
              <code>/v1/images/generations</code> con un solo Worker.
            </p>
            <Separator />
            <pre className="prompt-scrollbar overflow-x-auto rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed">
              <code>{WORKER_CODE}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Catálogo</div>
        <p className="text-xs text-muted-foreground">
          Modelos disponibles en el selector rápido de la cabecera y del composer. Cada uno tiene su propia clave
          API. Se guarda solo en este dispositivo; la primera vez se siembra desde una tabla pública de solo lectura.
        </p>
        {catalog.length === 0 && <p className="text-sm text-muted-foreground">No hay modelos en el catálogo.</p>}
        <div className="flex flex-col divide-y">
          {catalog.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{m.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.modelId} · {MODEL_CATEGORIES[m.category]}
                  </div>
                </div>
                {!m.apiKey && <StatusBadge ok={false} label="Sin clave" />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(m.id, m.name)}
                  aria-label="Borrar modelo del catálogo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                type="password"
                placeholder="nvapi-… (clave API de este modelo)"
                autoComplete="off"
                value={m.apiKey}
                onChange={(e) => updateModel(m.id, { apiKey: e.target.value })}
                className="h-8 text-xs"
                aria-label={`Clave API de ${m.name}`}
              />
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
          <Label htmlFor="newModelApiKey">Clave API</Label>
          <Input id="newModelApiKey" type="password" placeholder="nvapi-…" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <p className="text-xs text-muted-foreground">La consigues gratis en build.nvidia.com</p>
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

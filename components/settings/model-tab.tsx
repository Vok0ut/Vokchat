"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "./status-badge";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import type { Settings } from "@/lib/types";

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

export function ModelTab({ draft, patch }: { draft: Settings; patch: (p: Partial<Settings>) => void }) {
  const { catalog } = useModelCatalog();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [workerOpen, setWorkerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Conexión</div>
        <StatusBadge ok={!!draft.nimKey} label={draft.nimKey ? "NIM · ok" : "NIM · sin key"} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nimKey">NVIDIA NIM · API key</Label>
          <Input id="nimKey" type="password" placeholder="nvapi-…" autoComplete="off" value={draft.nimKey} onChange={(e) => patch({ nimKey: e.target.value })} />
          <p className="text-xs text-muted-foreground">La consigues gratis en build.nvidia.com</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Modelo y proxy</div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model">Modelo</Label>
          <Input id="model" list="modelListDatalist" placeholder="moonshotai/kimi-k2-instruct" autoComplete="off" value={draft.model} onChange={(e) => patch({ model: e.target.value })} />
          <datalist id="modelListDatalist">
            {catalog.map((m) => (
              <option key={m.id} value={m.modelId} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Las opciones vienen de tu catálogo (pestaña «Modelos»). Para usar las herramientas de GitHub, elige un
            modelo de categoría código/razonamiento con function calling.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proxy">Proxy CORS · necesario para NIM</Label>
          <Input id="proxy" type="url" placeholder="https://tu-worker.workers.dev" autoComplete="off" value={draft.proxy} onChange={(e) => patch({ proxy: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            La API de NVIDIA no permite llamadas directas desde el navegador. Despliega el mini-proxy de abajo
            (Cloudflare Worker gratis) y pega aquí su URL.
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
              <Label>Temperature · {draft.temperature.toFixed(2)}</Label>
              <Slider min={0} max={2} step={0.05} value={[draft.temperature]} onValueChange={([v]) => patch({ temperature: v })} />
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
    </div>
  );
}

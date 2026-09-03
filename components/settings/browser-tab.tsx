"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./status-badge";
import type { Settings } from "@/lib/types";

export function BrowserTab({ draft, patch }: { draft: Settings; patch: (p: Partial<Settings>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <StatusBadge ok={!!draft.bridgeUrl} label={draft.bridgeUrl ? "Navegador · on" : "Navegador · off"} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bridgeUrl">URL del servicio web</Label>
        <Input id="bridgeUrl" type="url" placeholder="https://tu-worker.workers.dev" autoComplete="off" value={draft.bridgeUrl} onChange={(e) => patch({ bridgeUrl: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          Le da al modelo acceso a internet (buscar y leer páginas). Dos formas de montarlo: un Cloudflare Worker
          simple (<code>web-worker/README.md</code>) o un navegador real con Obscura (
          <code>mcp-bridge/README.md</code>). Pega aquí la URL del que hayas desplegado.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bridgeToken">Token del servicio</Label>
        <Input id="bridgeToken" type="password" placeholder="token secreto" autoComplete="off" value={draft.bridgeToken} onChange={(e) => patch({ bridgeToken: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          El mismo valor que configuraste como <code>WEB_TOKEN</code> (Worker) o <code>BRIDGE_TOKEN</code> (Obscura).
        </p>
      </div>
    </div>
  );
}

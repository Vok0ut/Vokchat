"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./status-badge";
import type { Settings } from "@/lib/types";

export function GithubTab({ draft, patch }: { draft: Settings; patch: (p: Partial<Settings>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <StatusBadge ok={!!draft.ghToken} label={draft.ghToken ? "GitHub · on" : "GitHub · off"} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ghToken">GitHub · Personal Access Token</Label>
        <Input id="ghToken" type="password" placeholder="ghp_… o github_pat_…" autoComplete="off" value={draft.ghToken} onChange={(e) => patch({ ghToken: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          Con permiso <b>repo</b>. Activa herramientas: listar repos, leer archivos, buscar código y crear/editar
          archivos (con confirmación).
        </p>
      </div>
    </div>
  );
}

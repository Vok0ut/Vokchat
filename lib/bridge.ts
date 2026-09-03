import type { ToolDef } from "./types";

// Cache simple en módulo, igual que la app vanilla (clave = bridgeUrl+token).
let bridgeToolsCache: ToolDef[] | null = null;
let bridgeToolsCacheKey: string | null = null;

export function invalidateBridgeToolsCache(): void {
  bridgeToolsCache = null;
  bridgeToolsCacheKey = null;
}

export async function getBridgeToolDefs(bridgeUrl: string, bridgeToken: string): Promise<ToolDef[]> {
  if (!bridgeUrl) return [];
  const key = bridgeUrl + "|" + bridgeToken;
  if (bridgeToolsCache && bridgeToolsCacheKey === key) return bridgeToolsCache;
  const r = await fetch(bridgeUrl + "/tools", {
    headers: { Authorization: `Bearer ${bridgeToken}` },
  });
  if (!r.ok) throw new Error(`bridge ${r.status}`);
  const data = (await r.json()) as { tools?: ToolDef[] };
  bridgeToolsCache = data.tools || [];
  bridgeToolsCacheKey = key;
  return bridgeToolsCache!;
}

export async function callBridgeTool(
  bridgeUrl: string,
  bridgeToken: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const r = await fetch(bridgeUrl + "/call", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridgeToken}` },
    body: JSON.stringify({ name, arguments: args || {} }),
  });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`bridge ${r.status}: ${(data as { error?: string })?.error || "error"}`);
  return data;
}

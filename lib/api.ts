import type { ChatMessage, Settings, ToolCall, ToolDef } from "./types";

export function apiBase(cfg: Settings): string {
  return (cfg.proxy || "https://integrate.api.nvidia.com").replace(/\/$/, "");
}

export function clampNum(v: number | null | undefined, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function systemPrompt(cfg: Settings): string {
  if (cfg.systemPrompt && cfg.systemPrompt.trim()) return cfg.systemPrompt.trim();
  let p =
    "Eres un asistente conciso y util. Responde en el idioma del usuario. " +
    "Usa bloques de codigo con ``` cuando muestres codigo.";
  if (cfg.ghToken)
    p +=
      " Tienes herramientas para trabajar con los repositorios de GitHub del usuario. " +
      "Usalas cuando la pregunta lo requiera en lugar de inventar contenido de los repos.";
  if (cfg.bridgeUrl)
    p +=
      " Tienes herramientas web para buscar y leer paginas de internet. " +
      "Usalas para buscar informacion actual en internet en vez de inventarla o de decir que no tenes acceso a la web.";
  return p;
}

export interface CallModelResult {
  content: string;
  tool_calls?: ToolCall[];
}

interface SseToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface SseChunk {
  choices?: [{ delta?: { content?: string; tool_calls?: SseToolCallDelta[] } }];
}

/**
 * Llama al modelo con streaming SSE (compatible OpenAI). `onDelta(partialText)`
 * se invoca en cada trozo de texto recibido (string acumulado, no un diff) para
 * pintar la respuesta en vivo. Si el endpoint no soporta streaming, cae a una
 * respuesta JSON completa.
 */
export async function callModel(
  cfg: Settings,
  messages: ChatMessage[],
  tools: ToolDef[],
  signal: AbortSignal,
  onDelta: (partial: string) => void,
): Promise<CallModelResult> {
  const endpoint = `${apiBase(cfg)}/v1/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: cfg.maxTokens ? clampNum(cfg.maxTokens, 2048, 16, 32000) : 2048,
    temperature: clampNum(cfg.temperature, 0.6, 0, 2),
    stream: true,
    messages: [{ role: "system", content: systemPrompt(cfg) }, ...messages],
  };
  if (tools.length) body.tools = tools;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.nimKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${t.slice(0, 300)}`);
  }

  if (!r.body || !r.body.getReader) {
    // Entorno sin streams legibles: fallback a JSON completo.
    const data = await r.json().catch(() => null);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) throw new Error("Respuesta inesperada de la API (sin choices/message).");
    if (msg.content) onDelta(msg.content);
    return { content: msg.content || "", tool_calls: msg.tool_calls };
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  const toolCalls: ToolCall[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: SseChunk;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      const choice = evt.choices && evt.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onDelta(content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
          }
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function && tc.function.name) toolCalls[idx].function.name += tc.function.name;
          if (tc.function && typeof tc.function.arguments === "string") {
            toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }
    }
  }
  const finalToolCalls = toolCalls.filter(Boolean);
  return { content, tool_calls: finalToolCalls.length ? finalToolCalls : undefined };
}

/**
 * Genera una imagen (modelos de categoría "imagen", p.ej. Flux.2 Klein 4B) llamando
 * al endpoint de imágenes compatible con OpenAI (`/v1/images/generations`). Devuelve
 * la imagen en base64 (sin el prefijo data:). Formato asumido compatible con
 * images.generate() de OpenAI — sin verificar contra la API real de NVIDIA NIM
 * (ningún modelo del catálogo por defecto se ha probado end-to-end contra la API real).
 */
export async function generateImage(cfg: Settings, prompt: string, signal: AbortSignal): Promise<string> {
  const endpoint = `${apiBase(cfg)}/v1/images/generations`;
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.nimKey}` },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, response_format: "b64_json" }),
    signal,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json().catch(() => null);
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error("Respuesta inesperada de la API de imágenes (sin b64_json).");
  return b64 as string;
}

export function describeError(e: unknown): string {
  const msg = String((e as Error)?.message || e || "error desconocido");
  if (/API 401/.test(msg)) return "clave de NVIDIA NIM invalida o vencida (401). Revisa Ajustes > Modelo.";
  if (/API 403/.test(msg)) return "acceso denegado (403). Revisa permisos de la clave/token.";
  if (/API 429/.test(msg)) return "limite de peticiones alcanzado (429). Espera un momento y reintenta.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "no se pudo conectar (revisa el proxy CORS y tu conexion).";
  return msg;
}

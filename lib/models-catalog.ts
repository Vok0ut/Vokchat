import type { CatalogModel, ModelCategory } from "./types";

// Proyecto Supabase de solo lectura (RLS: select-only para "anon"), usado solo como
// semilla inicial del catálogo local — nunca se escribe nada de vuelta.
// Mismos valores que la app vanilla — no reconfigurar, el proyecto ya está provisionado.
export const SUPABASE_URL = "https://myzqlbwmjajadmqqjqcn.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15enFsYndtamFqYWRtcXFqcWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTA4NzEsImV4cCI6MjEwMzc2Njg3MX0.Daqsy_GAu-xkE49MvDKYjWPKjSPcBeDvfwqFTM3mdck";

export const MODEL_CATEGORIES: Record<ModelCategory, string> = {
  codigo: "Código",
  razonamiento: "Razonamiento",
  imagen: "Imagen",
};

export const DEFAULT_MODELS: CatalogModel[] = [
  {
    id: "seed-kimi",
    name: "Kimi K3",
    modelId: "moonshotai/kimi-k3",
    category: "codigo",
    apiKey: "",
  },
  {
    id: "seed-llama",
    name: "Llama 3.3 70B Instruct",
    modelId: "meta/llama-3.3-70b-instruct",
    category: "razonamiento",
    apiKey: "",
  },
  {
    id: "seed-flux",
    name: "Flux.2 Klein 4B",
    modelId: "black-forest-labs/flux.2-klein-4b",
    category: "imagen",
    apiKey: "",
  },
];

interface SupabaseModelRow {
  id: number | string;
  name: string;
  model_id: string;
  category: string;
}

/**
 * Fetches the public read-only Supabase seed table. Throws on any failure
 * (network, non-OK, empty array) so the caller can fall back to DEFAULT_MODELS.
 */
export async function fetchSupabaseSeed(): Promise<CatalogModel[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/models?select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`seed http ${r.status}`);
  const rows = (await r.json()) as SupabaseModelRow[];
  if (!Array.isArray(rows) || !rows.length) throw new Error("empty seed");
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    modelId: row.model_id,
    category: row.category as ModelCategory,
    apiKey: "",
  }));
}

// Heurística de "Conectar cuenta NIM" (Ajustes > Modelos): la API de NVIDIA NIM no
// expone un campo de tipo en /v1/models, así que se infiere por el nombre del id,
// igual que hacen otras herramientas de la comunidad contra el mismo catálogo.
// Deliberadamente imperfecta: lo que no matchea claramente se omite en vez de
// adivinar mal (el usuario puede sumarlo a mano con el formulario existente).
const EXCLUDE_HINTS = [
  "embed", "rerank", "guard", "safety", "moderation", "asr", "riva", "parakeet",
  "canary", "diariz", "tts", "ocr", "retriev", "translat", "clip", "colbert", "e5-",
  "esm", "alphafold", "openfold", "diffdock", "boltz", "rfdiffusion", "proteinmpnn",
  "molmim", "genmol", "evo2", "bionemo", "cosmos", "video", "physics", "earth2",
];
const IMAGE_HINTS = ["flux", "stable-diffusion", "sdxl", "sd3", "kolors", "dall-e", "playground-v", "sana"];
const CODE_HINTS = ["code", "coder", "codestral", "starcoder", "copilot"];
const CHAT_HINTS = [
  "instruct", "chat", "reason", "thinking", "nemotron", "llama", "mixtral", "mistral",
  "qwen", "gemma", "phi-", "gpt-oss", "hermes", "deepseek", "kimi", "grok", "command",
  "jamba", "granite", "falcon", "glm", "internlm", "vicuna",
];

/**
 * Adivina la categoría de un modelo NIM por su id (p.ej. "meta/llama-3.3-70b-instruct").
 * Devuelve null si no matchea nada reconocible o si matchea algo claramente no-chat/
 * no-imagen (embeddings, ASR/TTS, moderación, biología, etc.) — el llamador debe
 * omitir esos en vez de importarlos.
 */
export function guessModelCategory(modelId: string): ModelCategory | null {
  const id = modelId.toLowerCase();
  if (EXCLUDE_HINTS.some((h) => id.includes(h))) return null;
  if (IMAGE_HINTS.some((h) => id.includes(h))) return "imagen";
  if (CODE_HINTS.some((h) => id.includes(h))) return "codigo";
  if (CHAT_HINTS.some((h) => id.includes(h))) return "razonamiento";
  return null;
}

/** Pure selector: find the catalog category for a given model id, or null if unknown. */
export function getModelCategory(
  catalog: CatalogModel[] | null,
  modelId: string,
): ModelCategory | null {
  const entry = (catalog || []).find((m) => m.modelId === modelId);
  return entry ? entry.category : null;
}

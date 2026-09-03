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
    modelId: "moonshotai/kimi-k2-instruct",
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

/** Pure selector: find the catalog category for a given model id, or null if unknown. */
export function getModelCategory(
  catalog: CatalogModel[] | null,
  modelId: string,
): ModelCategory | null {
  const entry = (catalog || []).find((m) => m.modelId === modelId);
  return entry ? entry.category : null;
}

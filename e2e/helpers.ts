import type { Page } from "@playwright/test";

export const MODELS_KEY = "vok.models.v1";
export const CFG_KEY = "nimchat.cfg.v1";
export const APPEARANCE_KEY = "vok.appearance.v1";
export const CONV_KEY = "nimchat.convs.v1";

export interface SeedModel {
  id: string;
  name: string;
  modelId: string;
  category: "codigo" | "razonamiento" | "imagen";
  apiKey: string;
}

/**
 * Precarga localStorage ANTES de que cargue cualquier script de la página (vía
 * addInitScript), para que la app hidrate directamente con este estado en vez de
 * sembrar desde Supabase. Debe llamarse antes de `page.goto()`.
 */
export async function seedLocalStorage(
  page: Page,
  data: { models?: SeedModel[]; settings?: Record<string, unknown>; appearance?: Record<string, unknown> },
) {
  await page.addInitScript(
    ({ MODELS_KEY, CFG_KEY, APPEARANCE_KEY, data }) => {
      if (data.models) localStorage.setItem(MODELS_KEY, JSON.stringify(data.models));
      if (data.settings) localStorage.setItem(CFG_KEY, JSON.stringify(data.settings));
      if (data.appearance) localStorage.setItem(APPEARANCE_KEY, JSON.stringify(data.appearance));
    },
    { MODELS_KEY, CFG_KEY, APPEARANCE_KEY, data },
  );
}

export function defaultModel(overrides: Partial<SeedModel> = {}): SeedModel {
  return {
    id: "seed-test",
    name: "Modelo de prueba",
    modelId: "vendor/test-model",
    category: "codigo",
    apiKey: "test-fake-key",
    ...overrides,
  };
}

/** Intercepta la semilla pública de Supabase para que nunca golpee la red real. */
export async function mockSupabaseSeed(page: Page, models: SeedModel[] | null) {
  await page.route("https://myzqlbwmjajadmqqjqcn.supabase.co/rest/v1/models**", (route) => {
    if (models === null) return route.fulfill({ status: 500, body: "caido" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        models.map((m) => ({ id: m.id, name: m.name, model_id: m.modelId, category: m.category })),
      ),
    });
  });
}

function sseBody(chunks: { content?: string }[]): string {
  const lines = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: c }] })}\n\n`);
  lines.push("data: [DONE]\n\n");
  return lines.join("");
}

/** Simula /v1/chat/completions — éxito en streaming SSE, o cualquier status de error. */
export async function mockChatCompletion(
  page: Page,
  opts: { status?: number; body?: string; replyText?: string },
) {
  await page.route("https://integrate.api.nvidia.com/v1/chat/completions", (route) => {
    if (opts.status && opts.status !== 200) {
      return route.fulfill({ status: opts.status, body: opts.body ?? "error" });
    }
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody([{ content: opts.replyText ?? "respuesta simulada" }]),
    });
  });
}

/** Simula GET /v1/models (usado por "Conectar cuenta NIM") — lista de ids, o error. */
export async function mockAccountModels(page: Page, opts: { status?: number; body?: string; ids?: string[] }) {
  await page.route("https://integrate.api.nvidia.com/v1/models", (route) => {
    if (opts.status && opts.status !== 200) {
      return route.fulfill({ status: opts.status, body: opts.body ?? "error" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: (opts.ids ?? []).map((id) => ({ id, object: "model" })) }),
    });
  });
}

/** Simula /v1/images/generations — éxito con un PNG base64 mínimo, o error. */
export async function mockImageGeneration(page: Page, opts: { status?: number; body?: string }) {
  const TINY_PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  await page.route("https://integrate.api.nvidia.com/v1/images/generations", (route) => {
    if (opts.status && opts.status !== 200) {
      return route.fulfill({ status: opts.status, body: opts.body ?? "error" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ b64_json: TINY_PNG_B64 }] }),
    });
  });
}

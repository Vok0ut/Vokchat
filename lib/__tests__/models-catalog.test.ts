import { test } from "vitest";
import assert from "node:assert/strict";
import { fetchSupabaseSeed, getModelCategory, guessModelCategory, DEFAULT_MODELS } from "../models-catalog";

function withMockedFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("fetchSupabaseSeed mapea filas de Supabase a CatalogModel con apiKey vacía", async () => {
  await withMockedFetch(
    (async () =>
      new Response(
        JSON.stringify([{ id: 1, name: "Kimi K3", model_id: "moonshotai/kimi-k3", category: "codigo" }]),
        { status: 200 },
      )) as typeof fetch,
    async () => {
      const seed = await fetchSupabaseSeed();
      assert.deepEqual(seed, [
        { id: "1", name: "Kimi K3", modelId: "moonshotai/kimi-k3", category: "codigo", apiKey: "" },
      ]);
    },
  );
});

test("fetchSupabaseSeed lanza si la respuesta HTTP no es OK", async () => {
  await withMockedFetch(
    (async () => new Response("boom", { status: 500 })) as typeof fetch,
    async () => {
      await assert.rejects(() => fetchSupabaseSeed(), /seed http 500/);
    },
  );
});

test("fetchSupabaseSeed lanza si el array viene vacío", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify([]), { status: 200 })) as typeof fetch,
    async () => {
      await assert.rejects(() => fetchSupabaseSeed(), /empty seed/);
    },
  );
});

test("fetchSupabaseSeed lanza si la red falla", async () => {
  await withMockedFetch(
    (async () => {
      throw new Error("Failed to fetch");
    }) as typeof fetch,
    async () => {
      await assert.rejects(() => fetchSupabaseSeed(), /Failed to fetch/);
    },
  );
});

test("getModelCategory encuentra la categoría por modelId", () => {
  assert.equal(getModelCategory(DEFAULT_MODELS, "moonshotai/kimi-k3"), "codigo");
  assert.equal(getModelCategory(DEFAULT_MODELS, "black-forest-labs/flux.2-klein-4b"), "imagen");
});

test("getModelCategory devuelve null si el catálogo es null o el modelo no existe", () => {
  assert.equal(getModelCategory(null, "cualquiera"), null);
  assert.equal(getModelCategory(DEFAULT_MODELS, "no-existe"), null);
});

test("DEFAULT_MODELS ya no apunta al modelo Kimi retirado por NVIDIA (410)", () => {
  const kimi = DEFAULT_MODELS.find((m) => m.id === "seed-kimi");
  assert.equal(kimi?.modelId, "moonshotai/kimi-k3");
});

test("guessModelCategory reconoce modelos de imagen por palabras clave", () => {
  assert.equal(guessModelCategory("black-forest-labs/flux.1-dev"), "imagen");
  assert.equal(guessModelCategory("stabilityai/stable-diffusion-3-medium"), "imagen");
  assert.equal(guessModelCategory("stabilityai/sdxl-turbo"), "imagen");
});

test("guessModelCategory reconoce modelos de código por palabras clave", () => {
  assert.equal(guessModelCategory("mistralai/codestral-22b"), "codigo");
  assert.equal(guessModelCategory("bigcode/starcoder2-15b"), "codigo");
  assert.equal(guessModelCategory("qwen/qwen2.5-coder-32b-instruct"), "codigo");
});

test("guessModelCategory reconoce modelos de chat/razonamiento por palabras clave", () => {
  assert.equal(guessModelCategory("meta/llama-3.3-70b-instruct"), "razonamiento");
  assert.equal(guessModelCategory("moonshotai/kimi-k3"), "razonamiento");
  assert.equal(guessModelCategory("nvidia/llama-3.1-nemotron-70b-instruct"), "razonamiento");
});

test("guessModelCategory omite (devuelve null) modelos claramente no-chat/no-imagen", () => {
  assert.equal(guessModelCategory("nvidia/nv-embedqa-e5-v5"), null);
  assert.equal(guessModelCategory("nvidia/llama-3.2-nv-rerankqa-1b-v2"), null);
  assert.equal(guessModelCategory("meta/llama-guard-3-8b"), null);
  assert.equal(guessModelCategory("nvidia/parakeet-ctc-1.1b-asr"), null);
  assert.equal(guessModelCategory("meta-research/esmfold"), null);
});

test("guessModelCategory omite lo que no matchea ninguna palabra clave (más seguro que adivinar)", () => {
  assert.equal(guessModelCategory("acme/totalmente-desconocido-v7"), null);
});

import { test } from "vitest";
import assert from "node:assert/strict";
import { fetchSupabaseSeed, getModelCategory, DEFAULT_MODELS } from "../models-catalog";

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

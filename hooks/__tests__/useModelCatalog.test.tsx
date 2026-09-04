import { test, vi, beforeEach } from "vitest";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/models-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/models-catalog")>();
  return { ...actual, fetchSupabaseSeed: vi.fn() };
});

const { fetchSupabaseSeed, DEFAULT_MODELS } = await import("@/lib/models-catalog");
const { ModelCatalogProvider, useModelCatalog, MODELS_KEY } = await import("../useModelCatalog");
const { CFG_KEY } = await import("../useSettings");

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchSupabaseSeed).mockReset();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ModelCatalogProvider>{children}</ModelCatalogProvider>;
}

test("primer arranque (sin localStorage): siembra desde Supabase si la llamada tiene éxito", async () => {
  const seed = [{ id: "1", name: "X", modelId: "vendor/x", category: "codigo" as const, apiKey: "" }];
  vi.mocked(fetchSupabaseSeed).mockResolvedValue(seed);
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.deepEqual(result.current.catalog, seed));
});

test("primer arranque: si Supabase falla, cae a DEFAULT_MODELS", async () => {
  vi.mocked(fetchSupabaseSeed).mockRejectedValue(new Error("network"));
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.deepEqual(result.current.catalog, DEFAULT_MODELS));
});

test("un catálogo vaciado a propósito ([]) nunca se vuelve a sembrar desde Supabase", async () => {
  localStorage.setItem(MODELS_KEY, "[]");
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));
  assert.deepEqual(result.current.catalog, []);
  assert.equal(vi.mocked(fetchSupabaseSeed).mock.calls.length, 0);
});

test("addModel/removeModel/updateModel preservan el resto del catálogo intacto", async () => {
  localStorage.setItem(
    MODELS_KEY,
    JSON.stringify([{ id: "m1", name: "Uno", modelId: "vendor/uno", category: "codigo", apiKey: "clave-1" }]),
  );
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  act(() => result.current.addModel({ name: "Dos", modelId: "vendor/dos", category: "razonamiento", apiKey: "" }));
  assert.equal(result.current.catalog.length, 2);
  assert.equal(result.current.catalog[0].apiKey, "clave-1");

  const secondId = result.current.catalog[1].id;
  act(() => result.current.updateModel(secondId, { apiKey: "clave-2" }));
  assert.equal(result.current.catalog[1].apiKey, "clave-2");
  assert.equal(result.current.catalog[1].name, "Dos");
  assert.equal(result.current.catalog[0].apiKey, "clave-1", "actualizar un modelo no debe tocar los demás");

  act(() => result.current.removeModel("m1"));
  assert.equal(result.current.catalog.length, 1);
  assert.equal(result.current.catalog[0].id, secondId);
});

test("resetToDefaults reemplaza el catálogo completo por DEFAULT_MODELS (borra todas las claves)", async () => {
  localStorage.setItem(
    MODELS_KEY,
    JSON.stringify([{ id: "m1", name: "Uno", modelId: "vendor/uno", category: "codigo", apiKey: "clave-1" }]),
  );
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));
  act(() => result.current.resetToDefaults());
  assert.deepEqual(result.current.catalog, DEFAULT_MODELS);
});

test("migración: la clave legada (nimchat.cfg.v1.nimKey) rellena solo los modelos sin apiKey propia", async () => {
  localStorage.setItem(CFG_KEY, JSON.stringify({ nimKey: "clave-legada" }));
  localStorage.setItem(
    MODELS_KEY,
    JSON.stringify([
      { id: "m1", name: "Uno", modelId: "vendor/uno", category: "codigo", apiKey: "" },
      { id: "m2", name: "Dos", modelId: "vendor/dos", category: "codigo", apiKey: "clave-propia" },
    ]),
  );
  const { result } = renderHook(() => useModelCatalog(), { wrapper });
  await waitFor(() => assert.equal(result.current.catalog.find((m) => m.id === "m1")?.apiKey, "clave-legada"));
  assert.equal(
    result.current.catalog.find((m) => m.id === "m2")?.apiKey,
    "clave-propia",
    "nunca debe pisar una clave que el usuario ya puso por modelo",
  );
});

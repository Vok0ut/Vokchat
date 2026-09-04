import { test, vi, beforeEach } from "vitest";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/agent-loop", () => ({ agentLoop: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, generateImage: vi.fn() };
});

const { agentLoop } = await import("@/lib/agent-loop");
const { generateImage } = await import("@/lib/api");
const { useChat } = await import("../useChat");
const { SettingsProvider, useSettings, CFG_KEY, DEFAULT_SETTINGS } = await import("../useSettings");
const { ModelCatalogProvider, useModelCatalog, MODELS_KEY } = await import("../useModelCatalog");
const { ConversationsProvider } = await import("../useConversations");
const { ConfirmProvider } = await import("../useConfirm");

beforeEach(() => {
  localStorage.clear();
  vi.mocked(agentLoop).mockReset();
  vi.mocked(generateImage).mockReset();
});

function seedCatalogAndSettings(model: {
  modelId: string;
  category: "codigo" | "razonamiento" | "imagen";
  apiKey: string;
}) {
  localStorage.setItem(
    MODELS_KEY,
    JSON.stringify([{ id: "m1", name: "Test", modelId: model.modelId, category: model.category, apiKey: model.apiKey }]),
  );
  localStorage.setItem(CFG_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, model: model.modelId }));
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <SettingsProvider>
        <ModelCatalogProvider>
          <ConversationsProvider>{children}</ConversationsProvider>
        </ModelCatalogProvider>
      </SettingsProvider>
    </ConfirmProvider>
  );
}

function useTestHarness(onMissingKey?: () => void) {
  const chat = useChat({ onMissingKey });
  const settings = useSettings();
  const catalog = useModelCatalog();
  return { chat, settings, catalog };
}

async function waitHydrated(result: { current: ReturnType<typeof useTestHarness> }) {
  await waitFor(() => {
    assert.equal(result.current.settings.hydrated, true);
    assert.equal(result.current.catalog.hydrated, true);
  });
}

test("send() sin apiKey activa dispara onMissingKey y no llama a la API", async () => {
  seedCatalogAndSettings({ modelId: "vendor/sin-clave", category: "codigo", apiKey: "" });
  const onMissingKey = vi.fn();
  const { result } = renderHook(() => useTestHarness(onMissingKey), { wrapper });
  await waitHydrated(result);

  await act(async () => {
    await result.current.chat.send("hola");
  });

  assert.equal(onMissingKey.mock.calls.length, 1);
  assert.equal(vi.mocked(agentLoop).mock.calls.length, 0);
  assert.equal(result.current.chat.messages.length, 0);
});

test("send() con categoría de texto llama a agentLoop y persiste los mensajes finales", async () => {
  seedCatalogAndSettings({ modelId: "vendor/texto", category: "codigo", apiKey: "test-key" });
  // agentLoop real actualiza el estado visible vía onMessagesUpdate a medida que avanza
  // (no solo con el valor de retorno) — el mock tiene que respetar ese mismo contrato.
  vi.mocked(agentLoop).mockImplementation(async (_cfg, _key, base, _signal, callbacks) => {
    const messages = [...base, { role: "assistant" as const, content: "¡hola! ¿en qué ayudo?" }];
    callbacks.onMessagesUpdate(messages);
    return { messages, finalContent: "¡hola! ¿en qué ayudo?" };
  });
  const { result } = renderHook(() => useTestHarness(), { wrapper });
  await waitHydrated(result);

  await act(async () => {
    await result.current.chat.send("hola");
  });

  assert.equal(vi.mocked(agentLoop).mock.calls.length, 1);
  assert.equal(vi.mocked(agentLoop).mock.calls[0][1], "test-key");
  assert.equal(result.current.chat.messages.at(-1)?.content, "¡hola! ¿en qué ayudo?");
  assert.equal(result.current.chat.busy, false);
});

test("send() con categoría 'imagen' llama a generateImage en vez de agentLoop", async () => {
  seedCatalogAndSettings({ modelId: "vendor/imagen", category: "imagen", apiKey: "test-key" });
  vi.mocked(generateImage).mockResolvedValue("YmFzZTY0");
  const { result } = renderHook(() => useTestHarness(), { wrapper });
  await waitHydrated(result);

  await act(async () => {
    await result.current.chat.send("un gato programando");
  });

  assert.equal(vi.mocked(generateImage).mock.calls.length, 1);
  assert.equal(vi.mocked(agentLoop).mock.calls.length, 0);
  assert.equal(result.current.chat.messages.at(-1)?.image, "YmFzZTY0");
});

test("si la llamada falla, send() revierte los mensajes al estado previo y setea un aviso con describeError", async () => {
  seedCatalogAndSettings({ modelId: "vendor/texto", category: "codigo", apiKey: "clave-vencida" });
  vi.mocked(agentLoop).mockRejectedValue(new Error("API 401: clave invalida"));
  const { result } = renderHook(() => useTestHarness(), { wrapper });
  await waitHydrated(result);

  await act(async () => {
    await result.current.chat.send("hola");
  });

  assert.equal(result.current.chat.messages.length, 0, "el mensaje de usuario se revierte tras el error");
  assert.match(result.current.chat.transientNotice ?? "", /clave de NVIDIA NIM invalida/);
  assert.equal(result.current.chat.busy, false);
});

test("regenerateLast solo actúa si el último mensaje es del asistente", async () => {
  seedCatalogAndSettings({ modelId: "vendor/texto", category: "codigo", apiKey: "test-key" });
  vi.mocked(agentLoop)
    .mockImplementationOnce(async (_cfg, _key, base, _signal, callbacks) => {
      const messages = [...base, { role: "assistant" as const, content: "primera respuesta" }];
      callbacks.onMessagesUpdate(messages);
      return { messages, finalContent: "primera respuesta" };
    })
    .mockImplementationOnce(async (_cfg, _key, base, _signal, callbacks) => {
      const messages = [...base, { role: "assistant" as const, content: "segunda respuesta" }];
      callbacks.onMessagesUpdate(messages);
      return { messages, finalContent: "segunda respuesta" };
    });
  const { result } = renderHook(() => useTestHarness(), { wrapper });
  await waitHydrated(result);

  await act(async () => {
    await result.current.chat.send("hola");
  });
  await act(async () => {
    await result.current.chat.regenerateLast();
  });

  assert.equal(vi.mocked(agentLoop).mock.calls.length, 2);
  assert.equal(result.current.chat.messages.at(-1)?.content, "segunda respuesta");
});

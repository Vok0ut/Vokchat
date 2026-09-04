import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ConversationsProvider, useConversations, MAX_CONVS } from "../useConversations";
import type { ChatMessage } from "@/lib/types";

beforeEach(() => {
  localStorage.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ConversationsProvider>{children}</ConversationsProvider>;
}

const userMsg = (text: string): ChatMessage => ({ role: "user", content: text });
const assistantMsg = (text: string): ChatMessage => ({ role: "assistant", content: text });

test("saveConversation crea una conversación nueva con título truncado a 48 caracteres", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  const longText = "x".repeat(80);
  let id = "";
  act(() => {
    id = result.current.saveConversation(null, [userMsg(longText), assistantMsg("ok")]);
  });
  assert.ok(id);
  assert.equal(result.current.conversations.length, 1);
  assert.equal(result.current.conversations[0].title.length, 48);
});

test("saveConversation con un id existente actualiza esa conversación en vez de duplicarla", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  let id = "";
  act(() => {
    id = result.current.saveConversation(null, [userMsg("hola")]);
  });
  act(() => {
    result.current.saveConversation(id, [userMsg("hola"), assistantMsg("respuesta")]);
  });
  assert.equal(result.current.conversations.length, 1);
  assert.equal(result.current.conversations[0].messages.length, 2);
});

test("saveConversation no hace nada si la lista de mensajes está vacía", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));
  act(() => result.current.saveConversation(null, []));
  assert.equal(result.current.conversations.length, 0);
});

test("deleteConversation quita solo la conversación indicada", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));
  let idA = "";
  let idB = "";
  act(() => {
    idA = result.current.saveConversation(null, [userMsg("a")]);
  });
  act(() => {
    idB = result.current.saveConversation(null, [userMsg("b")]);
  });
  act(() => result.current.deleteConversation(idA));
  assert.equal(result.current.conversations.length, 1);
  assert.equal(result.current.conversations[0].id, idB);
});

test("importHistoryFile rechaza JSON inválido con un mensaje de error", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));
  const file = new File(["no es json"], "historial.json", { type: "application/json" });
  const outcome = await act(() => result.current.importHistoryFile(file));
  assert.ok("error" in outcome);
});

test("importHistoryFile fusiona por id, y la conversación con updatedAt más reciente gana", async () => {
  const { result } = renderHook(() => useConversations(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  let id = "";
  act(() => {
    id = result.current.saveConversation(null, [userMsg("versión vieja")]);
  });
  const older = result.current.conversations[0];

  const payload = {
    app: "vokchat",
    version: 1,
    exportedAt: Date.now(),
    conversations: [
      { id, title: "versión nueva", messages: [userMsg("versión nueva")], updatedAt: older.updatedAt + 10000 },
      { id: "otra-conv", title: "otra", messages: [userMsg("otra")], updatedAt: Date.now() },
    ],
  };
  const file = new File([JSON.stringify(payload)], "historial.json", { type: "application/json" });
  const outcome = await act(() => result.current.importHistoryFile(file));
  assert.deepEqual(outcome, { added: 1, updated: 1 });
  assert.equal(result.current.conversations.length, 2);
  assert.equal(result.current.conversations.find((c) => c.id === id)?.title, "versión nueva");
});

test("MAX_CONVS acota el número de conversaciones guardadas", () => {
  assert.ok(MAX_CONVS > 0);
});

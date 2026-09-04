import { test, vi, beforeEach } from "vitest";
import assert from "node:assert/strict";
import type { ChatMessage, Settings, ToolCall } from "../types";

vi.mock("../api", () => ({ callModel: vi.fn() }));
vi.mock("../github", () => ({
  githubToolDefs: [],
  runGithubTool: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../bridge", () => ({
  getBridgeToolDefs: vi.fn(async () => []),
  callBridgeTool: vi.fn(async () => ({ result: "ok" })),
}));

const { callModel } = await import("../api");
const { runGithubTool } = await import("../github");
const { callBridgeTool } = await import("../bridge");
const { agentLoop, runTool, toolCallSignature, MAX_REPEATED_CALLS, MAX_TOOL_STEPS } = await import("../agent-loop");

const BASE_CFG: Settings = {
  model: "moonshotai/kimi-k3",
  proxy: "",
  systemPrompt: "",
  temperature: 0.6,
  maxTokens: null,
  ghToken: "",
  bridgeUrl: "",
  bridgeToken: "",
};

function tc(name: string, args: string, id = "tc1"): ToolCall {
  return { id, type: "function", function: { name, arguments: args } };
}

function makeCallbacks() {
  const messagesUpdates: ChatMessage[][] = [];
  return {
    onDelta: () => {},
    onToolCallStart: () => {},
    onSystemNote: () => {},
    onBridgeWarning: () => {},
    onMessagesUpdate: (msgs: ChatMessage[]) => messagesUpdates.push(msgs),
    confirmWrite: async () => true,
    messagesUpdates,
  };
}

beforeEach(() => {
  vi.mocked(callModel).mockReset();
  vi.mocked(runGithubTool).mockClear();
  vi.mocked(callBridgeTool).mockClear();
});

test("toolCallSignature ordena y concatena nombre:argumentos, sin importar el orden de entrada", () => {
  const a = tc("b_tool", '{"x":1}', "1");
  const b = tc("a_tool", '{"y":2}', "2");
  assert.equal(toolCallSignature([a, b]), toolCallSignature([b, a]));
  assert.equal(toolCallSignature([a, b]), 'a_tool:{"y":2}|b_tool:{"x":1}');
});

test("runTool rutea nombres de GitHub a runGithubTool con el ghToken", async () => {
  const cfg = { ...BASE_CFG, ghToken: "gh_tok" };
  await runTool("list_repos", {}, cfg, async () => true);
  assert.equal(vi.mocked(runGithubTool).mock.calls[0][0], "list_repos");
  assert.equal(vi.mocked(runGithubTool).mock.calls[0][2], "gh_tok");
});

test("runTool rutea nombres desconocidos al bridge si hay bridgeUrl configurado", async () => {
  const cfg = { ...BASE_CFG, bridgeUrl: "http://localhost:1234", bridgeToken: "tok" };
  const result = await runTool("mi_tool", { a: 1 }, cfg, async () => true);
  assert.deepEqual(result, { result: "ok" });
  assert.equal(vi.mocked(callBridgeTool).mock.calls[0][0], "http://localhost:1234");
});

test("runTool devuelve error si el nombre no es de GitHub y no hay bridge configurado", async () => {
  const result = await runTool("mi_tool", {}, BASE_CFG, async () => true);
  assert.deepEqual(result, { error: "Herramienta desconocida: mi_tool" });
});

test("agentLoop devuelve un turno de texto simple sin tool_calls", async () => {
  vi.mocked(callModel).mockResolvedValueOnce({ content: "hola" });
  const callbacks = makeCallbacks();
  const result = await agentLoop(BASE_CFG, "key", [], new AbortController().signal, callbacks);
  assert.equal(result.finalContent, "hola");
  assert.deepEqual(result.messages, [{ role: "assistant", content: "hola" }]);
});

test("agentLoop ejecuta una ronda de tool-calls contra el bridge y hace la segunda llamada con el resultado", async () => {
  const cfg = { ...BASE_CFG, bridgeUrl: "http://localhost:1234" };
  vi.mocked(callModel)
    .mockResolvedValueOnce({ content: "", tool_calls: [tc("mi_tool", "{}")] })
    .mockResolvedValueOnce({ content: "listo" });
  const callbacks = makeCallbacks();
  const result = await agentLoop(cfg, "key", [], new AbortController().signal, callbacks);
  assert.equal(result.finalContent, "listo");
  assert.equal(vi.mocked(callBridgeTool).mock.calls.length, 1);
  const toolMsg = result.messages.find((m) => m.role === "tool");
  assert.equal(toolMsg?.content, JSON.stringify({ result: "ok" }));
  assert.equal(result.messages[result.messages.length - 1].content, "listo");
});

test("agentLoop detecta un bucle cuando el modelo repite la misma tool-call y se detiene antes del límite de pasos", async () => {
  const cfg = { ...BASE_CFG, bridgeUrl: "http://localhost:1234" };
  vi.mocked(callModel).mockImplementation(async () => ({
    content: "",
    tool_calls: [tc("mi_tool", '{"same":true}')],
  }));
  const callbacks = makeCallbacks();
  const result = await agentLoop(cfg, "key", [], new AbortController().signal, callbacks);
  assert.match(result.finalContent, /se detuvo para evitar un bucle/);
  assert.ok(vi.mocked(callModel).mock.calls.length <= MAX_REPEATED_CALLS + 1);
});

test("agentLoop se detiene tras MAX_TOOL_STEPS si el modelo nunca deja de pedir tools distintas", async () => {
  const cfg = { ...BASE_CFG, bridgeUrl: "http://localhost:1234" };
  let n = 0;
  vi.mocked(callModel).mockImplementation(async () => ({
    content: "",
    tool_calls: [tc("mi_tool", JSON.stringify({ n: n++ }))],
  }));
  const callbacks = makeCallbacks();
  const result = await agentLoop(cfg, "key", [], new AbortController().signal, callbacks);
  assert.match(result.finalContent, new RegExp(`limite de ${MAX_TOOL_STEPS} pasos`));
  assert.equal(vi.mocked(callModel).mock.calls.length, MAX_TOOL_STEPS);
});

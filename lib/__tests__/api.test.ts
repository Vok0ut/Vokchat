import { test } from "vitest";
import assert from "node:assert/strict";
import { apiBase, clampNum, systemPrompt, describeError, callModel, generateImage } from "../api";
import type { Settings } from "../types";

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

function withMockedFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("apiBase usa el default de NVIDIA NIM sin proxy y recorta la barra final", () => {
  assert.equal(apiBase(BASE_CFG), "https://integrate.api.nvidia.com");
  assert.equal(apiBase({ ...BASE_CFG, proxy: "https://mi-proxy.com/" }), "https://mi-proxy.com");
});

test("clampNum aplica el fallback si no es finito y recorta al rango [min,max]", () => {
  assert.equal(clampNum(null, 2048, 16, 32000), 2048);
  assert.equal(clampNum(NaN, 2048, 16, 32000), 2048);
  assert.equal(clampNum(5, 2048, 16, 32000), 16);
  assert.equal(clampNum(999999, 2048, 16, 32000), 32000);
  assert.equal(clampNum(500, 2048, 16, 32000), 500);
});

test("systemPrompt usa el prompt custom si está seteado, y sino agrega instrucciones de tools condicionalmente", () => {
  assert.equal(systemPrompt({ ...BASE_CFG, systemPrompt: "  sé breve  " }), "sé breve");
  const withGh = systemPrompt({ ...BASE_CFG, ghToken: "gh_tok" });
  assert.match(withGh, /herramientas para trabajar con los repositorios de GitHub/);
  const withBridge = systemPrompt({ ...BASE_CFG, bridgeUrl: "http://localhost:1234" });
  assert.match(withBridge, /herramientas web para buscar y leer paginas/);
  const plain = systemPrompt(BASE_CFG);
  assert.doesNotMatch(plain, /GitHub/);
  assert.doesNotMatch(plain, /paginas de internet/);
});

test("describeError mapea códigos de estado conocidos a mensajes en español", () => {
  assert.match(describeError(new Error("API 401: no autorizado")), /clave de NVIDIA NIM invalida/);
  assert.match(describeError(new Error("API 403: prohibido")), /acceso denegado/);
  assert.match(describeError(new Error("API 429: limite")), /limite de peticiones/);
  assert.match(describeError(new TypeError("Failed to fetch")), /no se pudo conectar/);
});

test("describeError deja pasar mensajes desconocidos tal cual (p.ej. 410 Gone)", () => {
  const msg = describeError(new Error('API 410: {"title":"Gone"}'));
  assert.match(msg, /API 410/);
});

test("describeError maneja valores no-Error", () => {
  assert.equal(describeError("boom"), "boom");
  assert.equal(describeError(undefined), "error desconocido");
});

test("callModel lanza con el status y el cuerpo recortado si la respuesta no es OK", async () => {
  await withMockedFetch(
    (async () => new Response("modelo retirado (410)", { status: 410 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => callModel(BASE_CFG, "fake-key", [], [], new AbortController().signal, () => {}),
        /API 410: modelo retirado \(410\)/,
      );
    },
  );
});

test("callModel acumula texto y tool_calls fragmentados desde un stream SSE", async () => {
  const encoder = new TextEncoder();
  const sseLines = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: "Hola" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: " mundo" } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "get_", arguments: "{" } }] } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "file", arguments: '"a"}' } }] } }] })}\n\n`,
    `data: [DONE]\n\n`,
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const line of sseLines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  const deltas: string[] = [];
  await withMockedFetch(
    (async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })) as typeof fetch,
    async () => {
      const result = await callModel(BASE_CFG, "fake-key", [], [], new AbortController().signal, (partial) =>
        deltas.push(partial),
      );
      assert.equal(result.content, "Hola mundo");
      assert.deepEqual(deltas, ["Hola", "Hola mundo"]);
      assert.deepEqual(result.tool_calls, [
        { id: "call_1", type: "function", function: { name: "get_file", arguments: '{"a"}' } },
      ]);
    },
  );
});

test("callModel cae a JSON completo cuando la respuesta no trae body legible por streams", async () => {
  await withMockedFetch(
    (async () =>
      ({
        ok: true,
        status: 200,
        body: undefined,
        text: async () => "",
        json: async () => ({ choices: [{ message: { content: "respuesta completa" } }] }),
      }) as unknown as Response) as typeof fetch,
    async () => {
      const deltas: string[] = [];
      const result = await callModel(BASE_CFG, "fake-key", [], [], new AbortController().signal, (p) =>
        deltas.push(p),
      );
      assert.equal(result.content, "respuesta completa");
      assert.deepEqual(deltas, ["respuesta completa"]);
    },
  );
});

test("generateImage devuelve el b64_json de la respuesta", async () => {
  await withMockedFetch(
    (async () =>
      new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), { status: 200 })) as typeof fetch,
    async () => {
      const b64 = await generateImage(BASE_CFG, "fake-key", "un gato", new AbortController().signal);
      assert.equal(b64, "aGVsbG8=");
    },
  );
});

test("generateImage lanza si la respuesta no trae b64_json", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => generateImage(BASE_CFG, "fake-key", "un gato", new AbortController().signal),
        /sin b64_json/,
      );
    },
  );
});

test("generateImage lanza con el status si la respuesta no es OK", async () => {
  await withMockedFetch(
    (async () => new Response("clave invalida", { status: 401 })) as typeof fetch,
    async () => {
      await assert.rejects(
        () => generateImage(BASE_CFG, "bad-key", "un gato", new AbortController().signal),
        /API 401: clave invalida/,
      );
    },
  );
});

import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { getBridgeToolDefs, callBridgeTool, invalidateBridgeToolsCache } from "../bridge";

function withMockedFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

beforeEach(() => {
  invalidateBridgeToolsCache();
});

test("getBridgeToolDefs devuelve [] sin llamar a la red si no hay bridgeUrl", async () => {
  await withMockedFetch(
    (async () => {
      throw new Error("no debería llamarse");
    }) as typeof fetch,
    async () => {
      const tools = await getBridgeToolDefs("", "tok");
      assert.deepEqual(tools, []);
    },
  );
});

test("getBridgeToolDefs cachea el resultado por bridgeUrl+token (no repite la llamada de red)", async () => {
  let calls = 0;
  await withMockedFetch(
    (async () => {
      calls++;
      return new Response(JSON.stringify({ tools: [{ type: "function", function: { name: "x", description: "", parameters: { type: "object", properties: {}, required: [] } } }] }), { status: 200 });
    }) as typeof fetch,
    async () => {
      const first = await getBridgeToolDefs("http://bridge", "tok");
      const second = await getBridgeToolDefs("http://bridge", "tok");
      assert.equal(calls, 1);
      assert.deepEqual(first, second);
    },
  );
});

test("getBridgeToolDefs lanza si la respuesta no es OK", async () => {
  await withMockedFetch(
    (async () => new Response("", { status: 503 })) as typeof fetch,
    async () => {
      await assert.rejects(() => getBridgeToolDefs("http://bridge-caido", "tok"), /bridge 503/);
    },
  );
});

test("callBridgeTool lanza con el error del body si la respuesta no es OK", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify({ error: "tool no encontrada" }), { status: 404 })) as typeof fetch,
    async () => {
      await assert.rejects(() => callBridgeTool("http://bridge", "tok", "inexistente", {}), /bridge 404: tool no encontrada/);
    },
  );
});

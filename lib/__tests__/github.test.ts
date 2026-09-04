import { test } from "vitest";
import assert from "node:assert/strict";
import { ghHeaders, ghFetch, b64decodeUtf8, b64encodeUtf8 } from "../github";

function withMockedFetch(impl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("ghHeaders arma el Authorization Bearer y los headers estándar de la API de GitHub", () => {
  const h = ghHeaders("gh_tok") as Record<string, string>;
  assert.equal(h.Authorization, "Bearer gh_tok");
  assert.equal(h.Accept, "application/vnd.github+json");
});

test("ghFetch devuelve el JSON de la respuesta cuando es OK", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify({ hello: "world" }), { status: 200 })) as typeof fetch,
    async () => {
      const data = await ghFetch("gh_tok", "/user/repos");
      assert.deepEqual(data, { hello: "world" });
    },
  );
});

test("ghFetch lanza con el status y el message de GitHub cuando la respuesta no es OK", async () => {
  await withMockedFetch(
    (async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })) as typeof fetch,
    async () => {
      await assert.rejects(() => ghFetch("bad_tok", "/user/repos"), /GitHub 401: Bad credentials/);
    },
  );
});

test("b64encodeUtf8/b64decodeUtf8 hacen round-trip con acentos y caracteres UTF-8", () => {
  const original = "áéíóú ñ € código";
  assert.equal(b64decodeUtf8(b64encodeUtf8(original)), original);
});

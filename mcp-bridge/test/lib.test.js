import test from "node:test";
import assert from "node:assert/strict";
import { toOpenAiTools, flattenToolResult, tokensMatch } from "../lib.js";

test("toOpenAiTools convierte tools MCP al formato function-calling de OpenAI", () => {
  const mcpTools = [
    { name: "buscar", description: "busca cosas", inputSchema: { type: "object", properties: { q: { type: "string" } } } },
    { name: "sin_desc_ni_schema" }
  ];
  const out = toOpenAiTools(mcpTools);
  assert.equal(out.length, 2);
  assert.equal(out[0].type, "function");
  assert.equal(out[0].function.name, "buscar");
  assert.equal(out[0].function.description, "busca cosas");
  assert.deepEqual(out[0].function.parameters, { type: "object", properties: { q: { type: "string" } } });
  // Sin description ni inputSchema: debe rellenar con defaults seguros, no lanzar.
  assert.equal(out[1].function.description, "");
  assert.deepEqual(out[1].function.parameters, { type: "object", properties: {} });
});

test("flattenToolResult aplana texto, imagen y recurso a un unico string", () => {
  const result = {
    isError: false,
    content: [
      { type: "text", text: "hola" },
      { type: "image", mimeType: "image/png" },
      { type: "resource", resource: { uri: "file:///x.txt" } },
      { type: "otro" }
    ]
  };
  const flat = flattenToolResult(result);
  assert.equal(flat.isError, false);
  assert.match(flat.text, /hola/);
  assert.match(flat.text, /imagen omitida: image\/png/);
  assert.match(flat.text, /recurso: file:\/\/\/x\.txt/);
  assert.match(flat.text, /contenido no textual: otro/);
});

test("flattenToolResult devuelve el resultado tal cual si no tiene content[]", () => {
  const raw = { foo: "bar" };
  assert.equal(flattenToolResult(raw), raw);
  assert.equal(flattenToolResult(null), null);
});

test("tokensMatch acepta tokens identicos", () => {
  assert.equal(tokensMatch("Bearer abc123", "Bearer abc123"), true);
});

test("tokensMatch rechaza tokens distintos de igual longitud", () => {
  assert.equal(tokensMatch("Bearer abc123", "Bearer abc124"), false);
});

test("tokensMatch rechaza tokens de distinta longitud sin lanzar", () => {
  assert.equal(tokensMatch("Bearer abc", "Bearer abcdefghij"), false);
});

test("tokensMatch rechaza valores no-string sin lanzar", () => {
  assert.equal(tokensMatch(undefined, "Bearer x"), false);
  assert.equal(tokensMatch(null, null), false);
});

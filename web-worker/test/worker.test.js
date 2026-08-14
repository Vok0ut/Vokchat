import test from "node:test";
import assert from "node:assert/strict";
import { htmlToText, runTool, toolDefs, timingSafeEqualStr, isBlockedHost } from "../worker.js";

test("htmlToText quita scripts, estilos y etiquetas, y decodifica entidades basicas", () => {
  const html = `<html><head><style>body{color:red}</style><script>alert(1)</script></head>
    <body><h1>Hola&nbsp;Mundo</h1><p>A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39;</p></body></html>`;
  const text = htmlToText(html);
  assert.doesNotMatch(text, /alert\(1\)/);
  assert.doesNotMatch(text, /color:red/);
  assert.doesNotMatch(text, /<h1>|<p>/);
  assert.match(text, /Hola Mundo/);
  assert.match(text, /A & B <tag> "q" 's'/);
});

test("toolDefs solo incluye web_search si hay BRAVE_KEY", () => {
  assert.equal(toolDefs({}).length, 1);
  assert.equal(toolDefs({})[0].function.name, "fetch_url");
  const withSearch = toolDefs({ BRAVE_KEY: "x" });
  assert.equal(withSearch.length, 2);
  assert.ok(withSearch.some(t => t.function.name === "web_search"));
});

test("runTool fetch_url rechaza sin 'url'", async () => {
  const res = await runTool("fetch_url", {}, {});
  assert.match(res.error, /falta 'url'/);
});

test("runTool fetch_url bloquea hosts locales/privados (SSRF)", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("no deberia llegar aqui"); };
  try {
    const targets = ["http://localhost/secret", "http://127.0.0.1:8080", "http://169.254.169.254/latest/meta-data", "http://192.168.1.1", "10.0.0.5"];
    for (const url of targets) {
      const res = await runTool("fetch_url", { url }, {});
      assert.match(res.error, /locales o privadas/, `debe bloquear ${url}`);
    }
    assert.equal(called, false, "no debe llegar a hacer fetch() real a un host bloqueado");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runTool fetch_url descarga y convierte HTML a texto para hosts publicos", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<p>contenido publico</p>", {
    status: 200, headers: { "content-type": "text/html" }
  });
  try {
    const res = await runTool("fetch_url", { url: "https://example.com" }, {});
    assert.equal(res.url, "https://example.com");
    assert.match(res.content, /contenido publico/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runTool web_search falla con claridad si no hay BRAVE_KEY", async () => {
  const res = await runTool("web_search", { query: "algo" }, {});
  assert.match(res.error, /BRAVE_KEY/);
});

test("runTool herramienta desconocida devuelve error", async () => {
  const res = await runTool("no_existe", {}, {});
  assert.match(res.error, /desconocida/);
});

test("timingSafeEqualStr compara correctamente", () => {
  assert.equal(timingSafeEqualStr("Bearer x", "Bearer x"), true);
  assert.equal(timingSafeEqualStr("Bearer x", "Bearer y"), false);
  assert.equal(timingSafeEqualStr("Bearer x", "Bearer xx"), false);
  assert.equal(timingSafeEqualStr(undefined, "Bearer x"), false);
});

test("isBlockedHost distingue hosts privados de publicos", () => {
  assert.equal(isBlockedHost("localhost"), true);
  assert.equal(isBlockedHost("127.0.0.1"), true);
  assert.equal(isBlockedHost("169.254.169.254"), true);
  assert.equal(isBlockedHost("192.168.0.10"), true);
  assert.equal(isBlockedHost("172.16.0.1"), true);
  assert.equal(isBlockedHost("172.31.255.255"), true);
  assert.equal(isBlockedHost("172.32.0.1"), false);
  assert.equal(isBlockedHost("10.1.2.3"), true);
  assert.equal(isBlockedHost("example.com"), false);
  assert.equal(isBlockedHost("8.8.8.8"), false);
});

/*
 * Vok Chat · Web Worker
 *
 * Opción SIN Docker y SIN servidor para dar acceso a internet al modelo.
 * Es un Cloudflare Worker que expone la misma interfaz que el mcp-bridge
 * (`GET /tools` y `POST /call` con auth Bearer), así que la pestaña
 * "Navegador" de Vok Chat funciona igual apuntando aquí — sin tocar nada
 * del frontend.
 *
 * Herramientas que ofrece al modelo:
 *   - fetch_url(url)      -> descarga una página y devuelve su texto legible.
 *   - web_search(query)   -> busca en la web (solo si defines BRAVE_KEY).
 *
 * A diferencia de Obscura, esto NO es un navegador real: no ejecuta el
 * JavaScript de la página ni hace clicks. Lee el HTML tal cual llega y lo
 * convierte a texto. Para la mayoría de webs de contenido alcanza.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  CONFIGURACIÓN (edita las dos líneas de abajo)                     │
 * └─────────────────────────────────────────────────────────────────┘
 * Es lo único que tenés que tocar. No hace falta usar la pantalla de
 * "Variables" de Cloudflare: escribí el token acá mismo y hacé Deploy.
 */

// Token secreto: poné cualquier texto largo y difícil (ej. "vok-8f3k2h9x7q").
// Es OBLIGATORIO. Este mismo valor va en Vok Chat → Navegador → "Token".
const TOKEN = "";

// (Opcional) API key de Brave Search para habilitar la búsqueda web.
// Se saca gratis en https://brave.com/search/api/ . Si la dejás "", el
// modelo solo podrá leer páginas (fetch_url), no buscar.
const BRAVE_KEY = "";

// ── A partir de aquí no necesitas cambiar nada ──────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const token = TOKEN || env.WEB_TOKEN;
    const cfg = { BRAVE_KEY: BRAVE_KEY || env.BRAVE_KEY };

    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    if (url.pathname === "/health") return cors(json({ ok: true, hasToken: !!token, search: !!cfg.BRAVE_KEY }));

    const auth = req.headers.get("Authorization") || "";
    if (!token || auth !== "Bearer " + token) return cors(json({ error: "unauthorized" }, 401));

    if (url.pathname === "/tools" && req.method === "GET") {
      return cors(json({ tools: toolDefs(cfg) }));
    }

    if (url.pathname === "/call" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch {}
      try {
        const result = await runTool(body.name, body.arguments || {}, cfg);
        return cors(json(result));
      } catch (e) {
        return cors(json({ error: String((e && e.message) || e) }));
      }
    }

    return cors(json({ error: "not found" }, 404));
  }
};

function toolDefs(env) {
  const defs = [{
    type: "function",
    function: {
      name: "fetch_url",
      description: "Descarga una pagina web y devuelve su texto legible. Usala para leer el contenido de una URL.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "URL completa, incluyendo https://" } },
        required: ["url"]
      }
    }
  }];
  if (env.BRAVE_KEY) {
    defs.push({
      type: "function",
      function: {
        name: "web_search",
        description: "Busca en la web y devuelve resultados con titulo, URL y descripcion. Usala para encontrar informacion actual antes de leer una pagina.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "terminos de busqueda" } },
          required: ["query"]
        }
      }
    });
  }
  return defs;
}

async function runTool(name, args, env) {
  if (name === "fetch_url") {
    let target = String(args.url || "").trim();
    if (!target) return { error: "falta 'url'" };
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    const r = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VokChatBot/1.0)" },
      redirect: "follow"
    });
    if (!r.ok) return { error: "HTTP " + r.status, url: target };
    const ct = r.headers.get("content-type") || "";
    let text = await r.text();
    if (ct.includes("html")) text = htmlToText(text);
    return { url: target, content: text.slice(0, 12000) };
  }

  if (name === "web_search") {
    if (!env.BRAVE_KEY) return { error: "busqueda no configurada (falta BRAVE_KEY en el Worker)" };
    const q = encodeURIComponent(String(args.query || ""));
    const r = await fetch("https://api.search.brave.com/res/v1/web/search?count=8&q=" + q, {
      headers: { "Accept": "application/json", "X-Subscription-Token": env.BRAVE_KEY }
    });
    if (!r.ok) return { error: "search " + r.status };
    const data = await r.json();
    const results = (((data.web && data.web.results) || [])).map(x => ({
      title: x.title, url: x.url, description: x.description
    }));
    return { results };
  }

  return { error: "herramienta desconocida: " + name };
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return res;
}

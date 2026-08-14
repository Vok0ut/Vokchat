import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { toOpenAiTools, flattenToolResult, tokensMatch } from "./lib.js";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.BRIDGE_TOKEN;
const MCP_COMMAND = process.env.MCP_COMMAND || "obscura";
const MCP_ARGS = (process.env.MCP_ARGS || "mcp").split(" ").filter(Boolean);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

if (!TOKEN) {
  console.error("Falta BRIDGE_TOKEN. Define un token secreto en el entorno antes de arrancar.");
  process.exit(1);
}

if (ALLOWED_ORIGIN === "*") {
  console.warn("Aviso: ALLOWED_ORIGIN no esta configurado, se permite cualquier origen (*). " +
    "Define ALLOWED_ORIGIN con el dominio de tu Vok Chat para restringirlo.");
}

let client = null;
let tools = [];
let connecting = null;

async function connectMcp() {
  const transport = new StdioClientTransport({ command: MCP_COMMAND, args: MCP_ARGS });
  const c = new Client({ name: "vokchat-bridge", version: "1.0.0" }, { capabilities: {} });

  transport.onclose = () => {
    console.error(`MCP (${MCP_COMMAND} ${MCP_ARGS.join(" ")}) cerró la conexión, reintentando en 3s...`);
    client = null;
    connecting = null;
    setTimeout(() => { connectMcp().catch(e => console.error("Reconexión fallida:", e)); }, 3000);
  };

  await c.connect(transport);
  const res = await c.listTools();
  client = c;
  tools = res.tools;
  console.log(`Conectado a MCP (${MCP_COMMAND} ${MCP_ARGS.join(" ")}). Tools: ${tools.map(t => t.name).join(", ")}`);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function checkAuth(req, res) {
  const auth = req.headers.authorization || "";
  if (!tokensMatch(auth, `Bearer ${TOKEN}`)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

app.get("/health", (req, res) => {
  res.json({ ok: !!client, tools: tools.length });
});

app.get("/tools", (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!client) return res.status(503).json({ error: "MCP no conectado todavía" });
  res.json({ tools: toOpenAiTools(tools) });
});

app.post("/call", async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!client) return res.status(503).json({ error: "MCP no conectado todavía" });
  const { name, arguments: args } = req.body || {};
  if (!name) return res.status(400).json({ error: "falta 'name'" });
  try {
    const result = await client.callTool({ name, arguments: args || {} });
    res.json(flattenToolResult(result));
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
});

connectMcp()
  .then(() => {
    app.listen(PORT, () => console.log(`Bridge escuchando en :${PORT}`));
  })
  .catch(e => {
    console.error("No se pudo conectar al servidor MCP:", e);
    process.exit(1);
  });

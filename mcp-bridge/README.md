# Vok Chat · MCP Bridge

Puente HTTP↔MCP para que Vok Chat (una página estática sin backend) pueda usar
herramientas de un servidor **MCP** real. Por defecto arranca
[Obscura](https://obscura.sh) (navegador headless open source pensado para
agentes) vía `obscura mcp`, pero funciona con cualquier servidor MCP que hable
stdio: solo cambiá `MCP_COMMAND` / `MCP_ARGS`.

## Qué hace

- Al arrancar, lanza el servidor MCP como subproceso y le habla por stdio
  usando el SDK oficial (`@modelcontextprotocol/sdk`).
- Expone dos endpoints HTTP (protegidos con un Bearer token):
  - `GET /tools` → la lista de tools del servidor MCP, ya traducida al
    formato `tools` de function-calling que usa la API de NVIDIA NIM.
  - `POST /call` con `{ "name": "...", "arguments": {...} }` → ejecuta la
    tool en el servidor MCP y devuelve el resultado como texto plano.
- Si el subproceso MCP muere, reintenta la conexión solo.

Este bridge es el "cliente MCP" que un navegador no puede ser por sí mismo
(no puede lanzar procesos ni hablar stdio). El frontend de Vok Chat solo hace
`fetch` normal a estos dos endpoints.

## Correr en local con Docker

```bash
docker build -t vokchat-mcp-bridge .
docker run --rm -p 8080:8080 \
  -e BRIDGE_TOKEN="elegí-un-token-largo-y-random" \
  vokchat-mcp-bridge
```

Probalo:

```bash
curl -H "Authorization: Bearer elegí-un-token-largo-y-random" http://localhost:8080/tools
```

## Desplegarlo (Fly.io, Render, Railway, un VPS con Docker…)

El bridge necesita un proceso persistente (no sirve un Worker de
Cloudflare/edge, porque hay que spawnear el binario de Obscura). Cualquier
plataforma que corra un `Dockerfile` de forma continua sirve. Dos opciones
simples con capa gratuita:

**Fly.io**
```bash
fly launch --dockerfile Dockerfile --no-deploy
fly secrets set BRIDGE_TOKEN="elegí-un-token-largo-y-random"
fly deploy
```

**Render** (Web Service → "Docker"):
1. Conectá el repo, elegí este directorio (`mcp-bridge`) como root.
2. Agregá la variable de entorno `BRIDGE_TOKEN`.
3. Deploy. Render te da una URL pública `https://tu-app.onrender.com`.

En cualquier caso, anotá la URL pública y el `BRIDGE_TOKEN` — van en
Vok Chat, pestaña de **Ajustes → Navegador**.

## Variables de entorno

| Variable         | Default   | Descripción                                             |
|------------------|-----------|----------------------------------------------------------|
| `BRIDGE_TOKEN`   | *(obligatorio)* | Token Bearer que debe mandar el cliente.            |
| `MCP_COMMAND`    | `obscura` | Ejecutable del servidor MCP a lanzar.                    |
| `MCP_ARGS`       | `mcp`     | Argumentos, separados por espacio.                       |
| `PORT`           | `8080`    | Puerto HTTP del bridge.                                  |
| `ALLOWED_ORIGIN` | `*`       | Header CORS. Restringilo al origen donde sirvas Vok Chat en producción. |

## Seguridad

- **No lo dejes sin `BRIDGE_TOKEN`** ni lo publiques sin HTTPS: quien tenga el
  token puede manejar un navegador real desde tu servidor (fetch a URLs
  internas, scraping, etc. — mismo riesgo que darle un navegador a cualquiera).
- Restringí `ALLOWED_ORIGIN` al dominio donde publiques Vok Chat en cuanto lo
  tengas, en vez de dejar `*`.
- Cada sesión de Obscura es un sandbox aislado (según su documentación), pero
  el bridge en sí no aísla nada entre llamadas: si te preocupa el abuso,
  agregá rate limiting delante (por ejemplo con el proxy/CDN que uses).

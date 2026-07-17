# Vok Chat · Web Worker (opción simple, sin Docker)

Le da al modelo **acceso a internet** con lo mínimo posible: un
[Cloudflare Worker](https://workers.cloudflare.com) que se despliega pegando
código en el panel web. **Sin Docker, sin servidor, sin línea de comandos.**

Expone la misma interfaz que `mcp-bridge` (`GET /tools` y `POST /call` con
token Bearer), así que la pestaña **Navegador** de Vok Chat funciona igual
apuntando aquí — no hay que cambiar nada del frontend.

## Qué puede hacer el modelo con esto

- `fetch_url(url)` — descarga una página y devuelve su texto legible.
- `web_search(query)` — busca en la web (solo si configurás `BRAVE_KEY`).

**Diferencia con Obscura:** esto *no* es un navegador real. No ejecuta el
JavaScript de la página ni hace clicks; lee el HTML tal cual llega y lo pasa a
texto. Para leer artículos, docs, noticias y demás alcanza. Si necesitás un
navegador de verdad (webs que cargan todo con JS, interacción, formularios),
ahí sí conviene la opción `mcp-bridge/` con Obscura.

## Desplegar (5 minutos, todo desde el navegador)

1. Entrá a [dash.cloudflare.com](https://dash.cloudflare.com) (creá cuenta
   gratis si no tenés).
2. **Workers & Pages → Create → Create Worker.** Ponele un nombre y **Deploy**
   (crea uno de ejemplo).
3. **Edit code.** Borrá todo y pegá el contenido de [`worker.js`](./worker.js).
4. En la parte de arriba del código, editá la línea del token:
   ```js
   const TOKEN = "";   →   const TOKEN = "el-secreto-que-elijas";
   ```
   Poné cualquier texto largo y difícil. **No hace falta tocar la pantalla de
   "Variables"** de Cloudflare: con esta línea alcanza.
   *(Opcional: si querés búsqueda web, pegá tu API key de
   [Brave Search](https://brave.com/search/api/) en `const BRAVE_KEY = "…"`.)*
5. **Deploy.**
6. Copiá la URL del Worker (algo como `https://tu-worker.tu-cuenta.workers.dev`).

> **Verificá que quedó bien:** abrí `https://tu-worker…workers.dev/health` en el
> navegador. Debe responder `{"ok":true,"hasToken":true,...}`. Si dice
> `"hasToken":false`, es que el token quedó vacío — revisá el paso 4 y
> volvé a hacer Deploy.

> Alternativa avanzada: en vez de la línea `TOKEN`, podés definir las variables
> `WEB_TOKEN` (y `BRAVE_KEY`) en **Settings → Variables and Secrets**. El código
> usa la línea si está, y si no, cae a la variable de entorno.

## Conectarlo en Vok Chat

Ajustes → pestaña **Navegador**:

- **URL del bridge MCP** → la URL del Worker.
- **Token del bridge** → el mismo valor que pusiste en `WEB_TOKEN`.

Guardá y probá pidiéndole algo que necesite internet ("leé tal página y
resumila", "buscá X"). En el chat vas a ver la tool (`fetch_url` / `web_search`)
ejecutándose antes de la respuesta.

## Seguridad

- El `WEB_TOKEN` evita que cualquiera use tu Worker. No lo compartas.
- El Worker corre en el edge de Cloudflare: sus `fetch` salen a internet
  público, no pueden alcanzar tu red local.
- `fetch_url` sigue redirecciones y trunca el contenido a ~12k caracteres para
  no saturar al modelo.

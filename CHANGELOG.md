# Changelog

## v2.7 — corrige el 405 de "Conectar cuenta NIM" contra el proxy Cloudflare Worker

### Corregido

- **"Conectar cuenta NIM" daba `API 405`** cuando el usuario tenía configurado
  el proxy CORS (Cloudflare Worker) documentado en Ajustes → Modelos: el
  código de ese Worker reenviaba **todas** las peticiones como `POST`
  siempre, algo que no importaba mientras la app solo llamaba a
  `/v1/chat/completions` y `/v1/images/generations` (ambos POST). La v2.6
  agregó una llamada `GET /v1/models`, que el Worker seguía reenviando como
  `POST` — y NVIDIA responde `405 Method Not Allowed` a un `POST` contra
  `/v1/models`. Se corrige la plantilla del Worker para que reenvíe el
  método real de la petición entrante (y se permite `GET` en
  `Access-Control-Allow-Methods`).

  **Importante — acción manual requerida**: este fix corrige la plantilla
  que muestra la app, pero **no** actualiza el Worker que ya tengas
  desplegado en tu propia cuenta de Cloudflare. Si ya usás un proxy y ves
  este error 405, tenés que copiar el código actualizado desde Ajustes →
  Modelos → "Código del proxy · Cloudflare Worker" y pegarlo en tu Worker
  existente (mismo nombre/URL, solo se reemplaza el código).

## v2.6 — Conectar cuenta NIM (importar varios modelos con una sola clave)

### Añadido

- **"Conectar cuenta NIM"** en Ajustes → Modelos: pegar una clave de
  build.nvidia.com y la app llama a `GET /v1/models` (mismo endpoint que
  usan herramientas como Hermes Agent para poblar su selector) para traer
  automáticamente los modelos de chat, código/razonamiento e imagen
  disponibles en esa cuenta, en vez de tener que cargarlos uno por uno.
  Como la API de NVIDIA no indica el tipo de cada modelo, se infiere por
  el nombre del id y se omiten los que claramente no son de chat ni de
  imagen (embeddings, ASR/TTS, reranking, moderación/"guard", modelos de
  biología, etc.) — esos no funcionarían con las dos únicas funciones que
  llama esta app. Pide confirmación antes de aplicar mostrando cuántos
  modelos son altas nuevas y cuántos actualizan la clave de uno ya
  presente en el catálogo. El formulario para añadir un modelo específico
  a mano sigue disponible tal cual.
- Tests: `lib/__tests__/models-catalog.test.ts` y `lib/__tests__/api.test.ts`
  amplían casos para la heurística de categoría y para `fetchAccountModels`;
  `hooks/__tests__/useModelCatalog.test.tsx` cubre `importModels`; nuevo
  caso E2E en `e2e/settings-models.spec.ts` con `GET /v1/models` mockeado.

## v2.5 — suite de pruebas automatizadas (unit + E2E + CI)

### Añadido

- **Tests unitarios (Vitest)**: cobertura de toda la lógica pura de `lib/`
  (`api.ts`, `agent-loop.ts`, `models-catalog.ts`, `github.ts`, `bridge.ts`,
  `utils.ts`) y de los hooks con estado en `localStorage` (`useSettings`,
  `useModelCatalog`, `useAppearance`, `useConversations`, `useChat`,
  `useLocalStorageStore`), 65 casos en total. `npm test` / `npm run
  test:watch`.
- **Tests end-to-end (Playwright)**: 23 casos que simulan flujos reales de
  usuario en un navegador headless — primer arranque y siembra del
  catálogo, envío de mensajes (éxito, errores 401/404/410/429/500, fallo de
  red, falta de clave), generación de imágenes, edición del catálogo de
  modelos, apariencia (acento y fondo personalizado), historial de
  conversaciones, manifest de la PWA y contraste en modo claro. Las
  llamadas a NVIDIA/Supabase se interceptan con `page.route()`; nunca se
  usan claves ni red reales. `npm run test:e2e`.
- **CI en GitHub Actions** (`.github/workflows/test.yml`): lint + tests
  unitarios, tests E2E, y las suites `node:test` ya existentes de
  `mcp-bridge`/`web-worker` corren en cada push y pull request.

### Corregido

- **`clampNum(null, ...)` no aplicaba el valor por defecto**: `Number(null)`
  es `0` (un valor finito), así que un `null` explícito se colaba como `0`
  y quedaba recortado al mínimo del rango en vez de usar el fallback
  documentado por la firma de la función.
- Esta rama también incorpora el fix de `moonshotai/kimi-k3` (ver v2.4) para
  que el propio catálogo por defecto usado en las pruebas ya no apunte al
  modelo retirado por NVIDIA.

## v2.4 — corrige el modelo "Kimi K3" muerto en el catálogo

### Corregido

- **"Kimi K3" daba API 410 (Gone)**: el ID de modelo sembrado por defecto, `moonshotai/kimi-k2-instruct`, fue retirado por NVIDIA (fin de vida el 2026-05-12) y ya no responde. Se actualiza a `moonshotai/kimi-k3` (el modelo vigente que corresponde al nombre ya mostrado), tanto en el fallback local (`DEFAULT_MODELS`) como en la tabla de Supabase que siembra las instalaciones nuevas. Quien ya tenga el catálogo sembrado con el ID viejo debe borrar y volver a añadir esa entrada en Ajustes → Modelos (o usar "Restaurar valores por defecto"), ya que la corrección no reescribe catálogos ya guardados en `localStorage`.

## v2.3 — revierte la tipografía terminal y corrige contraste en modo claro

### Corregido

- **Modo claro poco legible**: todas las clases de color de texto con modificador de opacidad (`text-foreground/NN`, `text-muted-foreground/NN`) del composer quedaban bien en modo oscuro pero muy lavadas/apenas visibles en modo claro (mezclar opacidad sobre un color produce un resultado distinto según el fondo de cada tema). Se sustituyen por los tokens de tema sin opacidad (`text-foreground`/`text-muted-foreground`), que ya están calibrados correctamente en ambos temas. Afecta al placeholder del composer, al nombre del modelo activo, a la etiqueta de creatividad, al desplegable de modelos y a los botones de cerrar/quitar adjunto.

### Cambiado

- **Se revierte la tipografía terminal** (JetBrains Mono) introducida en v2.2: chocaba visualmente con el resto del sistema de diseño (esquinas muy redondeadas, sombras suaves, estética "AI chat input"). Vuelve Geist Sans como fuente por defecto.

## v2.2 — icono PWA corregido, tipografía terminal y fondo personalizado

### Corregido

- **Icono al instalar en el móvil**: el manifest solo declaraba los iconos con `purpose: "maskable"`, así que Android/Chrome les aplicaba un recorte adaptativo (círculo/squircle) que dejaba el logo parcialmente cortado al instalar la app. Ahora cada tamaño (192 y 512) tiene también una variante `purpose: "any"`, que se instala sin recortar.

### Cambiado

- **Tipografía terminal**: toda la interfaz (cabecera, botones, burbujas de chat, composer, Ajustes) pasa a usar JetBrains Mono como fuente por defecto, dando más identidad "de terminal" sin tocar el resto del sistema de diseño (colores, espaciados, componentes shadcn).

### Añadido

- **Fondo personalizado**: de vuelta en Ajustes → Apariencia (existía en la versión vanilla-JS y se había descartado en la migración a Next.js). Se puede elegir una imagen del dispositivo; se guarda como URL de datos en `localStorage` (solo en este navegador) y se muestra fija al 60% de opacidad detrás del chat, sin tapar la legibilidad de cabecera, composer ni hojas de Ajustes/Historial.

## v2.1 — clave de API por modelo

### Cambiado

- **Clave de API por modelo**: se sustituye la única clave NIM global por una
  clave propia por cada entrada del catálogo (Ajustes → Modelos). Al añadir
  un modelo ahora se piden 4 campos (nombre, ID del modelo, clave API,
  categoría) en vez de 3, y cada fila del catálogo existente tiene su propio
  campo de clave editable en línea (con guardado inmediato, sin botón
  aparte), marcado con una insignia «Sin clave» mientras no se rellene. Los
  usuarios con una clave global ya configurada la heredan automáticamente en
  los modelos que aún no tengan clave propia, sin sobrescribir las que ya
  estuvieran puestas.
- **Pestaña «Modelo» eliminada**: sus otros campos (Proxy CORS, prompt de
  sistema, tokens máximos, y la documentación del Worker de Cloudflare) se
  trasladan a la pestaña «Modelos», que pasa a ser la única con ajustes de
  modelo/conexión. Esto corrige además el redirect confuso al elegir un
  modelo sin clave configurada: antes de enviar un mensaje aterrizaba en una
  pestaña «Modelo» separada del catálogo; ahora aterriza directo en
  «Modelos», junto al campo de clave que hay que rellenar.

### Técnico

- `CatalogModel` gana el campo `apiKey`; `Settings.nimKey` se elimina del
  tipo. `callModel`/`generateImage`/`agentLoop` reciben la clave resuelta del
  modelo activo como parámetro explícito en vez de leer una clave global.

## v2.0 — migración a Next.js + TypeScript + Tailwind + shadcn/ui

### Cambiado

- **Reescritura completa del frontend**: Vok Chat deja de ser un `index.html` estático sin build y pasa a ser una app Next.js 16 (App Router) + React 19 + TypeScript, con Tailwind CSS v4 y componentes shadcn/ui (estilo «New York»). Todo el estado sigue viviendo en `localStorage` con las mismas claves y formas exactas que antes (`nimchat.cfg.v1`, `nimchat.convs.v1`, `vok.models.v1`, con la misma distinción crítica `null`/`[]` en el catálogo), así que nadie pierde ajustes, catálogo ni historial al migrar. Las integraciones externas (NVIDIA NIM vía proxy CORS, Supabase para la semilla del catálogo) no se reconfiguran: mismos endpoints, mismas claves.
- **Nueva identidad visual**: se abandona la estética terminal (ASCII, corchetes, scanlines, grano, fondo personalizado) por una interfaz clara con tarjetas de sombra suave, esquinas muy redondeadas y transiciones tipo resorte, con modo claro/oscuro/sistema (`next-themes`) y un color de acento personalizable como único remanente de personalización visual (nueva clave `vok.appearance.v1`; `vok.look.v1` queda huérfana sin migrarse activamente).
- **Composer rediseñado**: nuevo composer expandible en píldora con selector de modelo y de «creatividad» (3 niveles de `temperature`, con el valor numérico exacto seguro accesible en Ajustes → Modelos), grabación de voz real (Web Speech API, sin fallback simulado — si el navegador no la soporta, la entrada de voz queda deshabilitada) y adjuntos de imagen reales enviados como contenido multi-parte estilo OpenAI a los modelos.

### Técnico

- Loop de streaming SSE, loop de `tool_calls` con detección de bucle, herramientas de GitHub (con confirmación de escritura ahora vía `AlertDialog` asíncrono en vez de `confirm()` bloqueante), bridge MCP y exportar/importar historial se portan sin cambios de comportamiento.
- Los stores de `localStorage` (`useSettings`, `useModelCatalog`, `useConversations`, `useAppearance`) se implementan como una única instancia compartida por `Context`, para que guardar en Ajustes sea visible de inmediato en el resto de la app.

## v1.9 — vuelta a la estética terminal + Ajustes rediseñado + selector rápido de modelo

### Cambiado

- **Estética terminal restaurada**: se revierte el rediseño visual "Hermes Agent" que se había probado brevemente (logo tipográfico, composer en píldora); vuelven el logo ASCII, la cabecera con corchetes y el composer con borde y símbolo `>`.
- **Ajustes reestructurado**: los campos de cada pestaña (Apariencia, Modelo, Modelos) se agrupan en tarjetas con rótulo de sección («Personalización», «Fondo y efectos», «Conexión», «Modelo y proxy», «Catálogo», «Añadir modelo») en vez de una lista plana de campos. Los botones «Guardar claves» / «Borrar claves» pasan a un pie fijo (sticky) siempre visible al hacer scroll dentro de la hoja. Se añaden estados `:hover` a inputs, pestañas, tarjetas de tema y botones fantasma.

### Añadido

- **Selector rápido de modelo**: tocar el nombre del modelo en la cabecera abre un desplegable con el catálogo completo (nombre, ID, categoría) para cambiar de modelo con un toque, sin entrar en Ajustes.

## v1.8 — catálogo de modelos y generación de imágenes

### Añadido

- **Catálogo de modelos** (nueva pestaña «Modelos» en Ajustes): lista editable de modelos NIM (nombre, ID de modelo, categoría — código / razonamiento / imagen) que sustituye a las opciones fijas que antes traía el datalist de la pestaña «Modelo». Permite añadir, borrar y restaurar el catálogo a sus 3 valores por defecto (Kimi K3, Llama 3.3 70B Instruct, Flux.2 Klein 4B). Se guarda en `localStorage` (`vok.models.v1`) y cada navegador gestiona el suyo.
- **Semilla desde Supabase**: en el primer arranque, si todavía no hay catálogo guardado localmente, la app intenta leer una tabla pública de solo lectura en Supabase (PostgREST, con `apikey` anónima embebida y RLS restringido a `select` para el rol `anon`) para poblar el catálogo inicial. Si la petición falla (sin red, CORS, etc.), cae automáticamente a una copia local de los mismos 3 valores por defecto, así que la app sigue funcionando sin conexión. Los cambios posteriores del usuario en el catálogo son solo locales y nunca se reenvían a Supabase.
- **Generación de imágenes**: al enviar un mensaje con un modelo de categoría «Imagen» seleccionado (p. ej. Flux.2 Klein 4B), la app usa el texto como prompt y llama a un endpoint de imágenes compatible con OpenAI (`/v1/images/generations`, respuesta en `b64_json`) en vez de al chat de texto. La imagen generada se muestra en el chat y se persiste en el historial de la conversación.

### Notas para quien despliegue el proxy Cloudflare Worker

- El Worker de ejemplo (Ajustes → Modelo → «Código del proxy») ahora reenvía la ruta entrante (`/v1/chat/completions` o `/v1/images/generations`) en vez de forzar siempre chat/completions, para poder servir también la generación de imágenes con un único despliegue. El chat de texto sigue funcionando igual con un Worker desplegado de una versión anterior; solo hace falta redeplegar la versión nueva para que los modelos de categoría «Imagen» funcionen.
- El shape exacto de la petición/respuesta del endpoint de imágenes de NVIDIA NIM se asumió compatible con el formato `images.generate()` de OpenAI a partir de documentación pública; si NVIDIA usa un formato distinto, el único punto de ajuste es la función `generateImage()` en `index.html`.

## v1.7 — mejoras de robustez, streaming y seguridad

### Corregido

- **Historial corrupto tras un error**: si `agentLoop` fallaba a mitad de una ronda de herramientas, solo se revertía el último mensaje (`messages.pop()`), dejando mensajes `assistant`/`tool` huérfanos que rompían la siguiente llamada a la API. Ahora se guarda la longitud del historial antes de la ronda y se revierte por completo (`messages.length = rollbackLen`).
- **`get_file` con directorios o binarios**: la herramienta de GitHub lanzaba una excepción no controlada si `path` apuntaba a un directorio o a un archivo binario (fallo del `decodeURIComponent` en `b64decodeUtf8`). Ahora valida el tipo y captura el error de decodificación con un mensaje claro.
- **Respuestas malformadas de la API**: si la API devolvía un cuerpo sin `choices`/`message` (p. ej. un error con otro formato), la app lanzaba un `TypeError` poco útil. Ahora se valida y se lanza un error descriptivo.
- **Envío accidental durante composición IME**: pulsar Enter mientras se compone texto en japonés/chino/coreano enviaba el mensaje a medio escribir. Se añadió el chequeo `e.isComposing`.
- **Límite de pasos de herramientas silencioso**: al alcanzar el límite de 6 pasos del agente, la respuesta no se mostraba en el chat ni quedaba en el historial. Ahora se añade como nota del sistema y se persiste.

### Añadido

- **Streaming en vivo (SSE)**: las respuestas del modelo ahora se muestran carácter a carácter a medida que llegan, incluido el ensamblado incremental de `tool_calls` fragmentados en múltiples deltas. Si el endpoint no soporta streaming, cae automáticamente a una respuesta JSON completa.
- **Botón «Detener»**: cancela la generación en curso mediante `AbortController`, tanto para respuestas colgadas como para detener una generación larga a mitad.
- **Botones «Copiar» y «Regenerar»** en cada respuesta del asistente, y **«Copiar»** en cada bloque de código.
- **Parámetros avanzados configurables** en Ajustes → Modelo: prompt de sistema personalizado, `temperature` y tokens máximos de respuesta (antes fijos en el código).
- **Mensajes de error más claros**: 401 (clave inválida), 403 (permisos), 429 (límite de peticiones) y fallos de red se distinguen con un texto específico en vez del error crudo de `fetch`.

### Seguridad

- **`mcp-bridge`**: la comparación del Bearer token ahora usa `crypto.timingSafeEqual` (tiempo constante) en vez de `!==`, para no filtrar información por timing attack. Aviso en consola si `ALLOWED_ORIGIN` queda en `*` (valor por defecto abierto a cualquier origen).
- **`web-worker`**: comparación de token en tiempo constante equivalente (`timingSafeEqualStr`). Nueva protección básica contra SSRF en `fetch_url`: bloquea `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16` (incluye el endpoint de metadatos de nube `169.254.169.254`), `192.168.0.0/16` y `172.16.0.0/12`.

### Tests

- `mcp-bridge/lib.js`: funciones puras (`toOpenAiTools`, `flattenToolResult`, `tokensMatch`) extraídas de `server.js` para poder testearlas sin levantar Express ni el proceso MCP. Cubiertas con `mcp-bridge/test/lib.test.js` (`npm test`, Node `node:test`, 7 casos).
- `web-worker/worker.js`: exports nombrados adicionales (`htmlToText`, `runTool`, `toolDefs`, `timingSafeEqualStr`, `isBlockedHost`) solo para tests — Cloudflare sigue usando únicamente el `export default`. Cubiertas con `web-worker/test/worker.test.js` (`npm test`, 9 casos, incluye verificación de que el guard SSRF bloquea los hosts privados antes de llegar a `fetch()`).
- Verificación manual en navegador (Chrome, vía `claude-in-chrome`) contra un servidor mock local que imita el endpoint OpenAI-compatible de NVIDIA NIM con streaming SSE: flujo normal, error 401, cancelación con «Detener», regeneración de respuesta, y bucle de `tool_calls` hasta el límite de pasos. Sin errores de consola en ningún caso.

### Notas para quien despliegue `mcp-bridge` o `web-worker`

- Define `ALLOWED_ORIGIN` (mcp-bridge) al dominio real donde sirvas `index.html` en vez de dejarlo en `*`.
- Sigue siendo responsabilidad de quien despliega `web-worker/worker.js` no subir el archivo con el `TOKEN` real ya escrito a un repositorio público; considera usar Cloudflare Secrets/Variables en vez de hardcodearlo si vas a versionar el archivo.

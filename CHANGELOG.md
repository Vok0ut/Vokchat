# Changelog

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

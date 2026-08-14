import { timingSafeEqual } from "node:crypto";

export function toOpenAiTools(mcpTools) {
  return mcpTools.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters: t.inputSchema || { type: "object", properties: {} }
    }
  }));
}

export function flattenToolResult(result) {
  if (!result || !Array.isArray(result.content)) return result;
  const text = result.content
    .map(part => {
      if (part.type === "text") return part.text;
      if (part.type === "image") return "[imagen omitida: " + (part.mimeType || "image") + "]";
      if (part.type === "resource") return "[recurso: " + (part.resource && part.resource.uri) + "]";
      return "[contenido no textual: " + part.type + "]";
    })
    .join("\n");
  return { text, isError: !!result.isError };
}

/**
 * Compara dos tokens en tiempo constante para no filtrar informacion por
 * temporizacion (timing attack) en el chequeo de Authorization: Bearer.
 */
export function tokensMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Comparamos el buffer contra si mismo para mantener un tiempo similar
    // y no revelar la longitud esperada a traves del timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

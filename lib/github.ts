import type { ToolDef } from "./types";

const GH = "https://api.github.com";

export function ghHeaders(ghToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function ghFetch(ghToken: string, path: string, opts: RequestInit = {}): Promise<unknown> {
  const r = await fetch(GH + path, { ...opts, headers: { ...ghHeaders(ghToken), ...(opts.headers || {}) } });
  const data: unknown = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(data as { message?: string })?.message || "error"}`);
  return data;
}

export function b64decodeUtf8(b64: string): string {
  return decodeURIComponent(
    Array.from(atob(b64.replace(/\n/g, "")), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
  );
}

export function b64encodeUtf8(str: string): string {
  return btoa(Array.from(new TextEncoder().encode(str), (b) => String.fromCharCode(b)).join(""));
}

export const githubToolDefs: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_repos",
      description: "Lista los repositorios del usuario autenticado (nombre, descripcion, lenguaje, ultima actualizacion).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "Lista el contenido de un directorio de un repositorio.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "formato owner/nombre" },
          path: { type: "string", description: "ruta del directorio, vacio para la raiz" },
        },
        required: ["repo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_file",
      description: "Lee el contenido de un archivo de texto de un repositorio.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "formato owner/nombre" },
          path: { type: "string", description: "ruta del archivo" },
        },
        required: ["repo", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Busca codigo en GitHub. Se puede acotar con qualifiers como repo:owner/nombre o user:usuario.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "consulta de busqueda" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_or_update_file",
      description: "Crea o actualiza un archivo en un repositorio haciendo commit. Requiere confirmacion del usuario.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "formato owner/nombre" },
          path: { type: "string", description: "ruta del archivo" },
          content: { type: "string", description: "contenido completo nuevo del archivo" },
          message: { type: "string", description: "mensaje del commit" },
          branch: { type: "string", description: "rama, opcional" },
        },
        required: ["repo", "path", "content", "message"],
      },
    },
  },
];

export type ConfirmFn = (opts: { title: string; description: string }) => Promise<boolean>;

/** Argumentos de tool de GitHub tal como los manda el modelo (JSON.parse de tool_calls). */
export interface GithubToolArgs {
  repo?: string;
  path?: string;
  content?: string;
  message?: string;
  branch?: string;
  query?: string;
}

interface GhRepo {
  full_name: string;
  private: boolean;
  language: string | null;
  description: string | null;
  updated_at: string;
  default_branch: string;
}

interface GhContentEntry {
  name: string;
  path: string;
  type: string;
  size: number;
  content?: string;
  sha?: string;
}

interface GhSearchCodeResult {
  items: { repository: { full_name: string }; path: string; html_url: string }[];
}

interface GhPutContentResult {
  commit?: { sha?: string };
  content?: { html_url?: string };
}

/**
 * Ejecuta una tool de GitHub. `confirmWrite` reemplaza al `confirm()` nativo bloqueante
 * de la app vanilla: es async (resuelto por un AlertDialog compartido), así que esta
 * función también es async incluso para las tools de solo lectura.
 */
export async function runGithubTool(
  name: string,
  args: GithubToolArgs,
  ghToken: string,
  confirmWrite: ConfirmFn,
): Promise<unknown> {
  switch (name) {
    case "list_repos": {
      const repos = (await ghFetch(ghToken, "/user/repos?per_page=60&sort=updated")) as GhRepo[];
      return repos.map((r) => ({
        full_name: r.full_name,
        private: r.private,
        language: r.language,
        description: r.description,
        updated_at: r.updated_at,
        default_branch: r.default_branch,
      }));
    }
    case "list_directory": {
      const data = (await ghFetch(ghToken, "/repos/" + args.repo + "/contents/" + (args.path || ""))) as
        | GhContentEntry
        | GhContentEntry[];
      return (Array.isArray(data) ? data : [data]).map((i) => ({
        name: i.name,
        path: i.path,
        type: i.type,
        size: i.size,
      }));
    }
    case "get_file": {
      const f = (await ghFetch(ghToken, "/repos/" + args.repo + "/contents/" + args.path)) as
        | GhContentEntry
        | GhContentEntry[];
      if (Array.isArray(f) || f.type !== "file") return { error: "La ruta no es un archivo (es un directorio)." };
      if (typeof f.content !== "string") return { error: "No se pudo leer el contenido del archivo." };
      if (f.size > 120000) return { error: `Archivo demasiado grande (${f.size} bytes)` };
      try {
        return { path: f.path, content: b64decodeUtf8(f.content) };
      } catch {
        return { error: "El archivo no parece texto UTF-8 (probablemente binario), no se puede mostrar." };
      }
    }
    case "search_code": {
      const d = (await ghFetch(ghToken, "/search/code?per_page=10&q=" + encodeURIComponent(args.query || ""))) as GhSearchCodeResult;
      return d.items.map((i) => ({ repo: i.repository.full_name, path: i.path, url: i.html_url }));
    }
    case "create_or_update_file": {
      const ok = await confirmWrite({
        title: "¿Permitir este commit?",
        description: `El modelo quiere hacer commit en:\n\n${args.repo} → ${args.path}\n\nMensaje: ${args.message}`,
      });
      if (!ok) return { cancelled: true, note: "El usuario rechazo el commit." };
      let sha: string | undefined;
      try {
        sha = ((await ghFetch(ghToken, "/repos/" + args.repo + "/contents/" + args.path)) as GhContentEntry).sha;
      } catch {
        // el archivo no existe todavía — está bien, se crea sin sha
      }
      const body: Record<string, unknown> = { message: args.message, content: b64encodeUtf8(args.content || "") };
      if (sha) body.sha = sha;
      if (args.branch) body.branch = args.branch;
      const res = (await ghFetch(ghToken, "/repos/" + args.repo + "/contents/" + args.path, {
        method: "PUT",
        body: JSON.stringify(body),
      })) as GhPutContentResult;
      return { committed: true, sha: res.commit?.sha, url: res.content?.html_url };
    }
    default:
      return { error: "Herramienta desconocida: " + name };
  }
}

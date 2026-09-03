import { callModel } from "./api";
import { githubToolDefs, runGithubTool, type ConfirmFn, type GithubToolArgs } from "./github";
import { getBridgeToolDefs, callBridgeTool } from "./bridge";
import type { ChatMessage, Settings, ToolCall, ToolDef } from "./types";

export const MAX_TOOL_STEPS = 20;
export const MAX_REPEATED_CALLS = 3;

export function toolCallSignature(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((tc) => tc.function.name + ":" + (tc.function.arguments || ""))
    .sort()
    .join("|");
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  cfg: Settings,
  confirmWrite: ConfirmFn,
): Promise<unknown> {
  const githubNames = ["list_repos", "list_directory", "get_file", "search_code", "create_or_update_file"];
  if (githubNames.includes(name)) {
    return runGithubTool(name, args as GithubToolArgs, cfg.ghToken, confirmWrite);
  }
  if (cfg.bridgeUrl) return callBridgeTool(cfg.bridgeUrl, cfg.bridgeToken, name, args);
  return { error: "Herramienta desconocida: " + name };
}

export interface AgentLoopCallbacks {
  onDelta: (partial: string) => void;
  onToolCallStart: (tc: ToolCall) => void;
  /** system-note messages that should be shown transiently AND appended to history */
  onSystemNote: (text: string) => void;
  /** bridge fetch failed — non-fatal warning, shown but doesn't abort the round */
  onBridgeWarning: (text: string) => void;
  /** Fired every time the working message list changes, for live progressive UI updates. */
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  confirmWrite: ConfirmFn;
}

export interface AgentLoopResult {
  /** The final message list to persist (input messages + everything the loop appended). */
  messages: ChatMessage[];
  finalContent: string;
}

/**
 * Ejecuta el loop de tool-calling con detección de bucle, igual que agentLoop() en la
 * app vanilla. `messages` es el historial ANTES de este turno (ya incluye el mensaje
 * de usuario más reciente); se devuelve el historial completo actualizado.
 */
export async function agentLoop(
  cfg: Settings,
  messages: ChatMessage[],
  signal: AbortSignal,
  callbacks: AgentLoopCallbacks,
): Promise<AgentLoopResult> {
  let working = [...messages];
  let lastSig: string | null = null;
  let repeatCount = 0;

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    let tools: ToolDef[] = [];
    if (cfg.ghToken) tools = tools.concat(githubToolDefs);
    if (cfg.bridgeUrl) {
      try {
        tools = tools.concat(await getBridgeToolDefs(cfg.bridgeUrl, cfg.bridgeToken));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        callbacks.onBridgeWarning(`Aviso: no se pudo conectar con el bridge de navegador (${msg}).`);
      }
    }

    const msg = await callModel(cfg, working, tools, signal, callbacks.onDelta);

    if (msg.tool_calls && msg.tool_calls.length) {
      const sig = toolCallSignature(msg.tool_calls);
      repeatCount = sig === lastSig ? repeatCount + 1 : 1;
      lastSig = sig;
      if (repeatCount > MAX_REPEATED_CALLS) {
        const names = [...new Set(msg.tool_calls.map((tc) => tc.function.name))].join(", ");
        const stuckMsg =
          `El modelo repitio la llamada a "${names}" con los mismos argumentos ${repeatCount} veces ` +
          "seguidas sin avanzar, asi que se detuvo para evitar un bucle. Puede ser que la " +
          "herramienta/bridge no este respondiendo bien, o que el pedido necesite reformularse.";
        callbacks.onSystemNote(stuckMsg);
        working = [...working, { role: "assistant", content: stuckMsg }];
        callbacks.onMessagesUpdate(working);
        return { messages: working, finalContent: stuckMsg };
      }

      working = [...working, { role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls }];
      callbacks.onMessagesUpdate(working);
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          // el modelo mandó JSON inválido — se ejecuta la tool igual con args vacíos
        }
        callbacks.onToolCallStart(tc);
        let result: unknown;
        try {
          result = await runTool(tc.function.name, args, cfg, callbacks.confirmWrite);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        working = [
          ...working,
          { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 24000) },
        ];
        callbacks.onMessagesUpdate(working);
      }
      continue;
    }

    working = [...working, { role: "assistant", content: msg.content || "" }];
    callbacks.onMessagesUpdate(working);
    return { messages: working, finalContent: msg.content || "" };
  }

  const limitMsg = `Se alcanzo el limite de ${MAX_TOOL_STEPS} pasos de herramientas para esta respuesta.`;
  callbacks.onSystemNote(limitMsg);
  working = [...working, { role: "assistant", content: limitMsg }];
  callbacks.onMessagesUpdate(working);
  return { messages: working, finalContent: limitMsg };
}

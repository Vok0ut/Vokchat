"use client";

import { useCallback, useRef, useState } from "react";
import { useSettings } from "./useSettings";
import { useModelCatalog } from "./useModelCatalog";
import { useConversations } from "./useConversations";
import { useConfirm } from "./useConfirm";
import { agentLoop } from "@/lib/agent-loop";
import { generateImage, describeError } from "@/lib/api";
import { getModelCategory } from "@/lib/models-catalog";
import type { ChatMessage, MessageContentPart, ToolCall } from "@/lib/types";

export interface UseChatOptions {
  /** Called when send() is attempted without a NIM API key configured. */
  onMissingKey?: () => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { settings } = useSettings();
  const { catalog } = useModelCatalog();
  const { saveConversation } = useConversations();
  const confirmWrite = useConfirm();

  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transientNotice, setTransientNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const category = getModelCategory(catalog, settings.model);

  const persist = useCallback(
    (msgs: ChatMessage[]) => {
      if (!msgs.length) return;
      const id = saveConversation(convId, msgs);
      setConvId(id);
    },
    [convId, saveConversation],
  );

  const runTextTurn = useCallback(
    async (base: ChatMessage[], signal: AbortSignal) => {
      setStreamingText("");
      const result = await agentLoop(settings, base, signal, {
        onDelta: (partial) => setStreamingText(partial),
        onToolCallStart: () => {
          // el propio onMessagesUpdate ya refleja el tool_call en el mensaje del asistente;
          // se limpia el streaming preview para que no quede un bubble de texto vacío colgando
          setStreamingText(null);
        },
        onSystemNote: () => {},
        onBridgeWarning: (text) => setTransientNotice(text),
        onMessagesUpdate: (msgs) => setMessages(msgs),
        confirmWrite,
      });
      setStreamingText(null);
      return result.messages;
    },
    [settings, confirmWrite],
  );

  const runImageTurn = useCallback(
    async (base: ChatMessage[], prompt: string, signal: AbortSignal) => {
      const b64 = await generateImage(settings, prompt, signal);
      const withImage: ChatMessage[] = [
        ...base,
        { role: "assistant", content: "[imagen generada]", image: b64 },
      ];
      setMessages(withImage);
      return withImage;
    },
    [settings],
  );

  const send = useCallback(
    async (text: string, images?: string[]) => {
      const trimmed = text.trim();
      if ((!trimmed && !(images && images.length)) || busy) return;
      if (!settings.nimKey) {
        options.onMissingKey?.();
        return;
      }
      setTransientNotice(null);

      const content: string | MessageContentPart[] =
        images && images.length
          ? [
              ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
              ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
            ]
          : trimmed;

      const beforeSend = messages;
      const withUser: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(withUser);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const final =
          category === "imagen"
            ? await runImageTurn(withUser, trimmed, controller.signal)
            : await runTextTurn(withUser, controller.signal);
        persist(final);
      } catch (e) {
        setMessages(beforeSend);
        setStreamingText(null);
        if (e instanceof Error && e.name === "AbortError") setTransientNotice("── generación detenida ──");
        else setTransientNotice("Error: " + describeError(e));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, settings.nimKey, messages, category, runImageTurn, runTextTurn, persist, options],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerateLast = useCallback(async () => {
    if (busy) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const base = messages.slice(0, -1);
    setMessages(base);
    setBusy(true);
    setTransientNotice(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let final: ChatMessage[];
      if (category === "imagen") {
        const lastUser = [...base].reverse().find((m) => m.role === "user");
        const prompt = lastUser ? (typeof lastUser.content === "string" ? lastUser.content : "") : "";
        final = lastUser ? await runImageTurn(base, prompt, controller.signal) : base;
      } else {
        final = await runTextTurn(base, controller.signal);
      }
      persist(final);
    } catch (e) {
      setMessages(messages); // revierte al estado previo (con el último assistant intacto)
      setStreamingText(null);
      if (e instanceof Error && e.name === "AbortError") setTransientNotice("── generación detenida ──");
      else setTransientNotice("Error: " + describeError(e));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, messages, category, runImageTurn, runTextTurn, persist]);

  const newConversation = useCallback(() => {
    if (messages.length) persist(messages);
    setConvId(null);
    setMessages([]);
    setStreamingText(null);
    setTransientNotice(null);
  }, [messages, persist]);

  const loadConversation = useCallback((id: string, msgs: ChatMessage[]) => {
    setConvId(id);
    setMessages(msgs);
    setStreamingText(null);
    setTransientNotice(null);
  }, []);

  return {
    convId,
    messages,
    streamingText,
    busy,
    transientNotice,
    category,
    send,
    stop,
    regenerateLast,
    newConversation,
    loadConversation,
  };
}

export type { ToolCall };

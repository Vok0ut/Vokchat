"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, Conversation, ConversationExport } from "@/lib/types";

export const CONV_KEY = "nimchat.convs.v1";
export const MAX_CONVS = 500;

function readAll(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(CONV_KEY) || "[]") as Conversation[];
  } catch {
    return [];
  }
}

function writeAll(list: Conversation[]) {
  try {
    localStorage.setItem(CONV_KEY, JSON.stringify(list));
  } catch {
    // cuota excedida u otro fallo de storage
  }
}

function isValidConv(c: unknown): c is Conversation {
  if (!c || typeof c !== "object") return false;
  const r = c as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    Array.isArray(r.messages) &&
    typeof r.updatedAt === "number"
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

interface ConversationsContextValue {
  conversations: Conversation[];
  hydrated: boolean;
  saveConversation: (id: string | null, messages: ChatMessage[]) => string;
  deleteConversation: (id: string) => void;
  exportHistory: () => void;
  importHistoryFile: (file: File) => Promise<{ added: number; updated: number } | { error: string }>;
}

const ConversationsContext = React.createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Sincroniza con localStorage (sistema externo) tras el primer render — patrón de
    // hidratación SSR-safe, no un anti-patrón.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(readAll());
    setHydrated(true);
  }, []);

  const saveConversation = useCallback((id: string | null, messages: ChatMessage[]): string => {
    if (!messages.length) return id || "";
    const convId = id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? String(firstUser.content).slice(0, 48) : "Sin título";
    const list = readAll();
    const conv: Conversation = { id: convId, title, messages, updatedAt: Date.now() };
    const idx = list.findIndex((c) => c.id === convId);
    if (idx >= 0) list[idx] = conv;
    else list.unshift(conv);
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    const capped = list.slice(0, MAX_CONVS);
    writeAll(capped);
    setConversations(capped);
    return convId;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    const list = readAll().filter((c) => c.id !== id);
    writeAll(list);
    setConversations(list);
  }, []);

  const exportHistory = useCallback(() => {
    const list = readAll();
    const payload: ConversationExport = { app: "vokchat", version: 1, exportedAt: Date.now(), conversations: list };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const name = `vokchat-historial-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const importHistoryFile = useCallback((file: File): Promise<{ added: number; updated: number } | { error: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        let data: unknown;
        try {
          data = JSON.parse(String(reader.result));
        } catch {
          resolve({ error: "Archivo no válido: no es JSON." });
          return;
        }
        const incoming = Array.isArray(data)
          ? data
          : (data as Record<string, unknown> | null)?.conversations;
        if (!Array.isArray(incoming)) {
          resolve({ error: "Archivo no válido: no contiene conversaciones." });
          return;
        }
        const valid = incoming.filter(isValidConv);
        if (!valid.length) {
          resolve({ error: "El archivo no contiene conversaciones reconocibles." });
          return;
        }
        const byId = new Map(readAll().map((c) => [c.id, c]));
        let added = 0;
        let updated = 0;
        valid.forEach((c) => {
          const existing = byId.get(c.id);
          if (!existing) {
            byId.set(c.id, c);
            added++;
          } else if (c.updatedAt > existing.updatedAt) {
            byId.set(c.id, c);
            updated++;
          }
        });
        const merged = Array.from(byId.values())
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_CONVS);
        writeAll(merged);
        setConversations(merged);
        resolve({ added, updated });
      };
      reader.onerror = () => resolve({ error: "No se pudo leer el archivo." });
      reader.readAsText(file);
    });
  }, []);

  const value = React.useMemo(
    () => ({ conversations, hydrated, saveConversation, deleteConversation, exportHistory, importHistoryFile }),
    [conversations, hydrated, saveConversation, deleteConversation, exportHistory, importHistoryFile],
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
  const ctx = React.useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversations must be used within a ConversationsProvider");
  return ctx;
}

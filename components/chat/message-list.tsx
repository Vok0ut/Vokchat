"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, SystemNoteBubble } from "./message-bubble";
import { MarkdownLite } from "./markdown-lite";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessage } from "@/lib/types";

export function MessageList({
  messages,
  streamingText,
  busy,
  transientNotice,
  onRegenerate,
}: {
  messages: ChatMessage[];
  streamingText: string | null;
  busy: boolean;
  transientNotice: string | null;
  onRegenerate: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamingText, transientNotice]);

  const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      {messages.length === 0 && streamingText === null && !busy && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="text-sm">Escribe algo para empezar a chatear.</p>
        </div>
      )}
      {messages
        .filter((m) => m.role !== "tool" && m.role !== "system")
        .map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            isLast={i === lastAssistantIdx && !busy}
            onRegenerate={onRegenerate}
          />
        ))}
      {streamingText !== null && (
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm">
          {streamingText === "" ? <TypingIndicator /> : <MarkdownLite text={streamingText} />}
        </div>
      )}
      {busy && streamingText === null && (
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5 shadow-sm">
          <TypingIndicator />
        </div>
      )}
      {transientNotice && <SystemNoteBubble text={transientNotice} />}
      <div ref={bottomRef} />
    </div>
  );
}

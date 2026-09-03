"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "./markdown-lite";
import { copyToClipboard } from "./code-block";
import type { ChatMessage } from "@/lib/types";

function textContentOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function imagesOf(content: ChatMessage["content"]): string[] {
  if (typeof content === "string") return [];
  return content
    .filter((p): p is { type: "image_url"; image_url: { url: string } } => p.type === "image_url")
    .map((p) => p.image_url.url);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        setCopied(ok);
        setTimeout(() => setCopied(null), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {copied === true ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied === true ? "Copiado" : "Copiar"}
    </button>
  );
}

export function MessageBubble({
  message,
  isLast,
  onRegenerate,
}: {
  message: ChatMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}) {
  if (message.role === "user") {
    const text = textContentOf(message.content);
    const images = imagesOf(message.content);
    return (
      <div className="flex flex-col items-end gap-1.5">
        {images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="size-20 rounded-xl border object-cover" />
            ))}
          </div>
        )}
        {text && (
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[13.5px] whitespace-pre-wrap text-primary-foreground shadow-sm">
            {text}
          </div>
        )}
      </div>
    );
  }

  if (message.role !== "assistant") return null;

  if (message.tool_calls && message.tool_calls.length) {
    return (
      <div className="flex flex-col gap-1.5">
        {message.tool_calls.map((tc) => (
          <ToolCallBubble key={tc.id} name={tc.function.name} args={tc.function.arguments} />
        ))}
      </div>
    );
  }

  if (message.image) {
    return (
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${message.image}`}
          alt="imagen generada"
          className="max-w-[85%] rounded-2xl border shadow-sm"
        />
      </div>
    );
  }

  const text = textContentOf(message.content);
  return (
    <div className="flex max-w-[90%] flex-col gap-1.5">
      <div
        className={cn(
          "rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm",
        )}
      >
        <MarkdownLite text={text} />
      </div>
      <div className="flex items-center gap-1.5 px-1">
        <CopyButton text={text} />
        {isLast && onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Regenerar
          </button>
        )}
      </div>
    </div>
  );
}

export function ToolCallBubble({ name, args }: { name: string; args: string }) {
  let pretty = args;
  try {
    pretty = JSON.stringify(JSON.parse(args || "{}"));
  } catch {
    // args parcial/inválido mientras se re-ensambla en streaming — se muestra tal cual
  }
  return (
    <div className="max-w-[90%] rounded-xl border border-dashed bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
      ▸ {name} {pretty}
    </div>
  );
}

export function SystemNoteBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full border bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground">{text}</div>
    </div>
  );
}

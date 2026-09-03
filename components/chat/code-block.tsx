"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // sigue al fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);

  const onCopy = async () => {
    const ok = await copyToClipboard(code);
    setCopied(ok);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="relative my-2 overflow-hidden rounded-xl border bg-muted/60">
      <pre className="prompt-scrollbar overflow-x-auto p-3 pt-8 text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-[10.5px] text-muted-foreground backdrop-blur transition-colors hover:text-foreground",
        )}
      >
        {copied === true ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied === true ? "Copiado" : copied === false ? "Error" : "Copiar"}
      </button>
    </div>
  );
}

export { copyToClipboard };

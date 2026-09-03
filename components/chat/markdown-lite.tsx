import { Fragment } from "react";
import { CodeBlock } from "./code-block";

/**
 * Renderizador de markdown deliberadamente mínimo — igual que renderMarkdownLite()
 * en la app vanilla: bloques ```fenced``` y `código inline`, nada más (no es un
 * parser de markdown completo a propósito).
 */
export function MarkdownLite({ text }: { text: string }) {
  const parts = String(text).split(/```/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const code = part.replace(/^[a-zA-Z0-9+-]*\n/, "");
          return <CodeBlock key={i} code={code} />;
        }
        return (
          <Fragment key={i}>
            {part.split(/(`[^`\n]+`)/).map((seg, j) =>
              /^`[^`\n]+`$/.test(seg) ? (
                <code key={j} className="rounded bg-muted px-1.5 py-0.5 text-[0.92em]">
                  {seg.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{seg}</span>
              ),
            )}
          </Fragment>
        );
      })}
    </>
  );
}

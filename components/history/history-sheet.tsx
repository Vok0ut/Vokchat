"use client";

import { useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConversationListItem } from "./conversation-list-item";
import { useConversations } from "@/hooks/useConversations";
import type { ChatMessage } from "@/lib/types";

export function HistorySheet({
  open,
  onOpenChange,
  activeConvId,
  onLoadConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeConvId: string | null;
  onLoadConversation: (id: string, messages: ChatMessage[]) => void;
}) {
  const { conversations, deleteConversation, exportHistory, importHistoryFile } = useConversations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await importHistoryFile(file);
    if ("error" in result) alert(result.error);
    else alert(`Historial importado: ${result.added} nuevas, ${result.updated} actualizadas.`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[85vh] flex-col rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Conversaciones</SheetTitle>
          <SheetDescription>Guardadas en este dispositivo. Toca una para retomarla.</SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 px-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={exportHistory}>
            Exportar historial
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>
            Importar historial
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
        </div>
        <p className="px-4 text-[11px] text-muted-foreground">
          Se descarga un .json con tus conversaciones (sin claves ni tokens). Guárdalo donde quieras como copia de
          seguridad.
        </p>

        <div className="prompt-scrollbar flex-1 overflow-y-auto px-4 pb-4">
          {conversations.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay conversaciones guardadas todavía.</p>}
          <div className="flex flex-col gap-2">
            {conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={c.id === activeConvId}
                onLoad={() => onLoadConversation(c.id, c.messages)}
                onDelete={() => deleteConversation(c.id)}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

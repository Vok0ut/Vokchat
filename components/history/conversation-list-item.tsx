"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import type { Conversation } from "@/lib/types";

export function ConversationListItem({
  conversation,
  active,
  onLoad,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({ title: "¿Borrar conversación?", description: "Esta conversación se borrará de este dispositivo.", destructive: true });
    if (ok) onDelete();
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${active ? "border-primary/40 bg-primary/5" : ""}`}>
      <button type="button" onClick={onLoad} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm">{conversation.title}</div>
        <div className="text-[11px] text-muted-foreground">{new Date(conversation.updatedAt).toLocaleString()}</div>
      </button>
      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={handleDelete} aria-label="Borrar conversación">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Header } from "./header";
import { MessageList } from "./message-list";
import { PromptInput } from "@/components/composer/ai-chat-input";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { HistorySheet } from "@/components/history/history-sheet";
import { useChat } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export function ChatApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);

  const { settings, updateSettings } = useSettings();
  const { catalog } = useModelCatalog();
  const { backgroundImage } = useAppearance();

  const openSettingsAt = (tab?: string) => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  };

  const chat = useChat({ onMissingKey: () => openSettingsAt("modelos") });

  return (
    <div className={cn("flex h-dvh flex-col", !backgroundImage && "bg-background")}>
      {backgroundImage && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <Header
        catalog={catalog}
        activeModelId={settings.model}
        onSelectModel={(modelId) => updateSettings({ model: modelId })}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => openSettingsAt(undefined)}
        onNewConversation={() => chat.newConversation()}
      />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <MessageList
          messages={chat.messages}
          streamingText={chat.streamingText}
          busy={chat.busy}
          transientNotice={chat.transientNotice}
          onRegenerate={chat.regenerateLast}
        />
      </main>

      <div className="flex justify-center px-4 pb-4">
        <PromptInput
          catalog={catalog}
          activeModelId={settings.model}
          onModelChange={(modelId) => updateSettings({ model: modelId })}
          temperature={settings.temperature}
          onTemperatureChange={(t) => updateSettings({ temperature: t })}
          busy={chat.busy}
          onSubmit={(text, images) => chat.send(text, images)}
          onStop={chat.stop}
        />
      </div>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} initialTab={settingsInitialTab} />
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeConvId={chat.convId}
        onLoadConversation={(id: string, messages: ChatMessage[]) => {
          chat.loadConversation(id, messages);
          setHistoryOpen(false);
        }}
      />
    </div>
  );
}

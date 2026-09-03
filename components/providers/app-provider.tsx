"use client";

import { ThemeProvider } from "next-themes";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { SettingsProvider } from "@/hooks/useSettings";
import { ModelCatalogProvider } from "@/hooks/useModelCatalog";
import { ConversationsProvider } from "@/hooks/useConversations";
import { AppearanceProvider } from "@/hooks/useAppearance";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="vok.color-mode">
      <ConfirmProvider>
        <SettingsProvider>
          <ModelCatalogProvider>
            <ConversationsProvider>
              <AppearanceProvider>{children}</AppearanceProvider>
            </ConversationsProvider>
          </ModelCatalogProvider>
        </SettingsProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}

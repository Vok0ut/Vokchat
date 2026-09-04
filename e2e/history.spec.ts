import { test, expect } from "@playwright/test";
import { seedLocalStorage, defaultModel, mockChatCompletion } from "./helpers";

const MODEL = defaultModel({ modelId: "vendor/history-test", apiKey: "test-fake-key" });

test("una conversación nueva persiste tras enviar y aparece en el historial", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await mockChatCompletion(page, { replyText: "respuesta guardada" });
  await page.goto("/");

  await page.getByRole("button", { name: "Abrir el campo de mensaje" }).click();
  await page.getByRole("textbox", { name: "Mensaje" }).fill("conversación de prueba");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("respuesta guardada")).toBeVisible();

  await page.getByRole("button", { name: "Conversaciones" }).click();
  await expect(page.getByRole("dialog").getByText("conversación de prueba")).toBeVisible();
});

test("borrar una conversación del historial la quita de la lista", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await mockChatCompletion(page, { replyText: "respuesta de prueba" });
  await page.goto("/");

  await page.getByRole("button", { name: "Abrir el campo de mensaje" }).click();
  await page.getByRole("textbox", { name: "Mensaje" }).fill("para borrar");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("respuesta de prueba")).toBeVisible();

  await page.getByRole("button", { name: "Conversaciones" }).click();
  await expect(page.getByRole("dialog").getByText("para borrar")).toBeVisible();
  await page.getByRole("button", { name: "Borrar conversación" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("No hay conversaciones guardadas todavía.")).toBeVisible();
});

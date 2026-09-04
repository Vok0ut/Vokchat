import { test, expect } from "@playwright/test";
import { seedLocalStorage, defaultModel, mockImageGeneration } from "./helpers";

const MODEL = defaultModel({ modelId: "vendor/image-test", category: "imagen", apiKey: "test-fake-key" });

async function openComposerAndType(page: import("@playwright/test").Page, text: string) {
  await page.getByRole("button", { name: "Abrir el campo de mensaje" }).click();
  await page.getByRole("textbox", { name: "Mensaje" }).fill(text);
}

test("un modelo de categoría 'imagen' genera y muestra la imagen resultante", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await mockImageGeneration(page, {});
  await page.goto("/");

  await openComposerAndType(page, "un gato programando");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByAltText("imagen generada")).toBeVisible();
});

test("un error al generar la imagen se muestra como aviso", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await mockImageGeneration(page, { status: 500, body: "fallo del modelo de imagen" });
  await page.goto("/");

  await openComposerAndType(page, "un gato programando");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText(/^Error:/)).toBeVisible();
});

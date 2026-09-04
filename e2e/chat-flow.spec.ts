import { test, expect } from "@playwright/test";
import { seedLocalStorage, defaultModel, mockChatCompletion } from "./helpers";

const MODEL = defaultModel({ modelId: "vendor/chat-test", apiKey: "test-fake-key" });

async function openComposerAndType(page: import("@playwright/test").Page, text: string) {
  await page.getByRole("button", { name: "Abrir el campo de mensaje" }).click();
  await page.getByRole("textbox", { name: "Mensaje" }).fill(text);
}

test("enviar un mensaje con respuesta exitosa muestra la burbuja del asistente", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await mockChatCompletion(page, { replyText: "¡hola! ¿en qué te ayudo?" });
  await page.goto("/");

  await openComposerAndType(page, "hola");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText("¡hola! ¿en qué te ayudo?")).toBeVisible();
});

for (const status of [401, 404, 410, 429, 500]) {
  test(`un error ${status} de la API se muestra como aviso legible`, async ({ page }) => {
    await seedLocalStorage(page, {
      models: [MODEL],
      settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
    });
    await mockChatCompletion(page, { status, body: `detalle del error ${status}` });
    await page.goto("/");

    await openComposerAndType(page, "hola");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText(new RegExp(`^Error:.*${status}`))).toBeVisible();
  });
}

test("un fallo de red (sin conexión) muestra el aviso de 'no se pudo conectar'", async ({ page }) => {
  await seedLocalStorage(page, {
    models: [MODEL],
    settings: { model: MODEL.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  await page.route("https://integrate.api.nvidia.com/v1/chat/completions", (route) => route.abort("failed"));
  await page.goto("/");

  await openComposerAndType(page, "hola");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText(/no se pudo conectar/)).toBeVisible();
});

test("enviar sin una clave API configurada abre Ajustes en la pestaña Modelos en vez de llamar a la API", async ({
  page,
}) => {
  const modelSinClave = defaultModel({ modelId: "vendor/sin-clave", apiKey: "" });
  await seedLocalStorage(page, {
    models: [modelSinClave],
    settings: { model: modelSinClave.modelId, proxy: "", systemPrompt: "", temperature: 0.6, maxTokens: null, ghToken: "", bridgeUrl: "", bridgeToken: "" },
  });
  let apiCalled = false;
  await page.route("https://integrate.api.nvidia.com/v1/chat/completions", (route) => {
    apiCalled = true;
    return route.fulfill({ status: 200, body: "no debería llegar aquí" });
  });
  await page.goto("/");

  await openComposerAndType(page, "hola");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByRole("dialog").getByText("Ajustes")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Modelos" })).toHaveAttribute("data-state", "active");
  expect(apiCalled).toBe(false);
});

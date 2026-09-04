import { test, expect } from "@playwright/test";
import { seedLocalStorage, defaultModel, mockSupabaseSeed } from "./helpers";

async function openModelsTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("tab", { name: "Modelos" }).click();
  return page.getByRole("tabpanel", { name: "Modelos" });
}

test("añadir un modelo nuevo desde el formulario de 4 campos lo agrega al catálogo", async ({ page }) => {
  await seedLocalStorage(page, { models: [] });
  await page.goto("/");
  const panel = await openModelsTab(page);

  await page.locator("#newModelName").fill("Mi Modelo");
  await page.locator("#newModelId").fill("vendor/mi-modelo");
  await page.locator("#newModelApiKey").fill("nvapi-test-123");
  await page.getByRole("button", { name: "Razonamiento" }).click();
  await page.getByRole("button", { name: "Añadir modelo" }).click();

  await expect(panel.getByText("Mi Modelo")).toBeVisible();
  await expect(panel.getByText("vendor/mi-modelo · Razonamiento")).toBeVisible();
});

test("editar la clave API de una fila cambia el StatusBadge de 'Sin clave' a configurada", async ({ page }) => {
  const model = defaultModel({ name: "Modelo Pendiente", apiKey: "" });
  await seedLocalStorage(page, { models: [model] });
  await page.goto("/");
  const panel = await openModelsTab(page);

  await expect(panel.getByText("Sin clave", { exact: true })).toBeVisible();
  await page.getByLabel(`Clave API de ${model.name}`).fill("nvapi-nueva-clave");
  await expect(panel.getByText("Sin clave", { exact: true })).toHaveCount(0);
});

test("borrar un modelo pide confirmación y lo quita del catálogo", async ({ page }) => {
  const model = defaultModel({ name: "Modelo Descartable" });
  await seedLocalStorage(page, { models: [model] });
  await page.goto("/");
  const panel = await openModelsTab(page);

  await page.getByRole("button", { name: "Borrar modelo del catálogo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();

  await expect(panel.getByText("Modelo Descartable")).toHaveCount(0);
});

test("restaurar valores por defecto reemplaza el catálogo y borra todas las claves", async ({ page }) => {
  const model = defaultModel({ name: "Modelo Custom", modelId: "vendor/custom", apiKey: "clave-custom" });
  await seedLocalStorage(page, { models: [model] });
  await mockSupabaseSeed(page, null);
  await page.goto("/");
  const panel = await openModelsTab(page);

  await page.getByRole("button", { name: "Restaurar valores por defecto" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();

  await expect(panel.getByText("Modelo Custom")).toHaveCount(0);
  await expect(panel.getByText("Kimi K3")).toBeVisible();
  await expect(panel.getByText("Sin clave", { exact: true }).first()).toBeVisible();
});

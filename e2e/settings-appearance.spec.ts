import { test, expect } from "@playwright/test";
import path from "node:path";
import { seedLocalStorage } from "./helpers";

async function openAppearanceTab(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("tab", { name: "Apariencia" }).click();
}

test("elegir un color de acento actualiza la variable CSS --primary del documento", async ({ page }) => {
  await seedLocalStorage(page, { models: [] });
  await page.goto("/");
  await openAppearanceTab(page);

  await page.getByRole("button", { name: "Usar acento #16a34a" }).click();

  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary")))
    .toBe("#16a34a");
});

test("subir un fondo personalizado lo aplica con overlay a opacidad fija (60%)", async ({ page }) => {
  await seedLocalStorage(page, { models: [] });
  await page.goto("/");
  await openAppearanceTab(page);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Elegir imagen" }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(path.join(__dirname, "fixtures", "background.png"));

  await expect(page.getByRole("button", { name: "Quitar fondo" })).toBeVisible();

  const overlayOpacity = await page.evaluate(() => {
    const overlay = document.querySelector('[aria-hidden="true"][style*="background-image"]') as HTMLElement | null;
    return overlay ? getComputedStyle(overlay).opacity : null;
  });
  expect(overlayOpacity).toBe("0.6");

  await page.getByRole("button", { name: "Quitar fondo" }).click();
  await expect(page.getByRole("button", { name: "Quitar fondo" })).toHaveCount(0);
});

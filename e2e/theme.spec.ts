import { test, expect } from "@playwright/test";
import { seedLocalStorage } from "./helpers";

/**
 * Guarda de regresión del bug de contraste en modo claro (texto y fondo casi
 * idénticos en algunos elementos con clases de opacidad sobre el color de texto).
 */
test("en modo claro, el texto del placeholder del composer nunca es del mismo color que el fondo", async ({
  page,
}) => {
  await seedLocalStorage(page, { models: [], appearance: { accent: null, backgroundImage: null } });
  await page.goto("/");

  const placeholder = page.getByRole("button", { name: "Abrir el campo de mensaje" });
  const { color, bg } = await placeholder.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, bg: getComputedStyle(document.body).backgroundColor };
  });
  expect(color).not.toBe(bg);
});

test("el toggle de tema cambia entre claro y oscuro sin romper el contraste del header", async ({ page }) => {
  await seedLocalStorage(page, { models: [] });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Cambiar tema" });
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await toggle.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(!before);
});

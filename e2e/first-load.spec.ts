import { test, expect } from "@playwright/test";
import { mockSupabaseSeed } from "./helpers";

test("primer arranque: siembra el catálogo desde Supabase, incluido el Kimi K3 vigente (no el 410 retirado)", async ({
  page,
}) => {
  await mockSupabaseSeed(page, [
    { id: "1", name: "Kimi K3", modelId: "moonshotai/kimi-k3", category: "codigo", apiKey: "" },
    { id: "2", name: "Llama 3.3 70B Instruct", modelId: "meta/llama-3.3-70b-instruct", category: "razonamiento", apiKey: "" },
    { id: "3", name: "Flux.2 Klein 4B", modelId: "black-forest-labs/flux.2-klein-4b", category: "imagen", apiKey: "" },
  ]);
  await page.goto("/");

  await page.getByRole("button", { name: "Elegir modelo", exact: true }).click();
  await expect(page.getByText("moonshotai/kimi-k3")).toBeVisible();
  await expect(page.getByText("moonshotai/kimi-k2-instruct")).toHaveCount(0);
});

test("primer arranque: si Supabase falla, cae a los modelos por defecto (mismo Kimi K3 vigente)", async ({ page }) => {
  await mockSupabaseSeed(page, null);
  await page.goto("/");

  await page.getByRole("button", { name: "Elegir modelo", exact: true }).click();
  await expect(page.getByText("moonshotai/kimi-k3")).toBeVisible();
});

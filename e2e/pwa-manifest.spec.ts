import { test, expect } from "@playwright/test";

test("el manifest de la PWA declara los 4 iconos (any + maskable en 192 y 512)", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();

  expect(manifest.name).toBe("Vok Chat");
  expect(manifest.icons).toHaveLength(4);
  const purposesFor = (size: string) =>
    manifest.icons.filter((i: { sizes: string }) => i.sizes === size).map((i: { purpose: string }) => i.purpose);
  expect(purposesFor("192x192").sort()).toEqual(["any", "maskable"]);
  expect(purposesFor("512x512").sort()).toEqual(["any", "maskable"]);
});

import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AppearanceProvider, useAppearance } from "../useAppearance";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--primary-foreground");
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <AppearanceProvider>{children}</AppearanceProvider>;
}

test("setAccent y setBackgroundImage son independientes (uno no pisa al otro)", async () => {
  const { result } = renderHook(() => useAppearance(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  act(() => result.current.setAccent("#336699"));
  assert.equal(result.current.accent, "#336699");
  assert.equal(result.current.backgroundImage, null);

  act(() => result.current.setBackgroundImage("data:image/png;base64,xyz"));
  assert.equal(result.current.backgroundImage, "data:image/png;base64,xyz");
  assert.equal(result.current.accent, "#336699", "setBackgroundImage no debe borrar el accent ya puesto");

  act(() => result.current.setAccent("#ff0000"));
  assert.equal(result.current.accent, "#ff0000");
  assert.equal(
    result.current.backgroundImage,
    "data:image/png;base64,xyz",
    "setAccent no debe borrar el backgroundImage ya puesto",
  );
});

test("setAccent aplica --primary y un --primary-foreground legible como efecto secundario", async () => {
  const { result } = renderHook(() => useAppearance(), { wrapper });
  await waitFor(() => assert.equal(result.current.hydrated, true));

  act(() => result.current.setAccent("#0a0a0a"));
  await waitFor(() => assert.equal(document.documentElement.style.getPropertyValue("--primary"), "#0a0a0a"));
  assert.equal(document.documentElement.style.getPropertyValue("--primary-foreground"), "#ffffff");

  act(() => result.current.setAccent(null));
  await waitFor(() => assert.equal(document.documentElement.style.getPropertyValue("--primary"), ""));
});

import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import { SettingsProvider, useSettings, DEFAULT_SETTINGS } from "../useSettings";

beforeEach(() => {
  localStorage.clear();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

test("useSettings arranca con DEFAULT_SETTINGS", () => {
  const { result } = renderHook(() => useSettings(), { wrapper });
  assert.deepEqual(result.current.settings, DEFAULT_SETTINGS);
});

test("updateSettings hace merge parcial sin pisar el resto de campos", () => {
  const { result } = renderHook(() => useSettings(), { wrapper });
  act(() => result.current.updateSettings({ model: "moonshotai/kimi-k3" }));
  act(() => result.current.updateSettings({ temperature: 1.2 }));
  assert.equal(result.current.settings.model, "moonshotai/kimi-k3");
  assert.equal(result.current.settings.temperature, 1.2);
  assert.equal(result.current.settings.proxy, DEFAULT_SETTINGS.proxy);
});

test("wipeSettings vuelve a DEFAULT_SETTINGS", () => {
  const { result } = renderHook(() => useSettings(), { wrapper });
  act(() => result.current.updateSettings({ model: "algo", ghToken: "tok" }));
  act(() => result.current.wipeSettings());
  assert.deepEqual(result.current.settings, DEFAULT_SETTINGS);
});

test("useSettings fuera de un SettingsProvider lanza", () => {
  assert.throws(() => renderHook(() => useSettings()), /useSettings must be used within a SettingsProvider/);
});

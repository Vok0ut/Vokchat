import { test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorageStore } from "../useLocalStorageStore";

beforeEach(() => {
  localStorage.clear();
});

test("useLocalStorageStore hidrata con el valor inicial si no hay nada guardado", () => {
  const { result } = renderHook(() => useLocalStorageStore("test.key", { a: 1 }));
  const [value, , hydrated] = result.current;
  assert.deepEqual(value, { a: 1 });
  assert.equal(hydrated, true);
});

test("useLocalStorageStore hidrata con el valor previamente guardado", () => {
  localStorage.setItem("test.key", JSON.stringify({ a: 99 }));
  const { result } = renderHook(() => useLocalStorageStore("test.key", { a: 1 }));
  assert.deepEqual(result.current[0], { a: 99 });
});

test("setValue persiste en localStorage y acepta un updater funcional", () => {
  const { result } = renderHook(() => useLocalStorageStore("test.key", { a: 1 }));
  act(() => {
    result.current[1]((prev) => ({ a: prev.a + 1 }));
  });
  assert.deepEqual(result.current[0], { a: 2 });
  assert.deepEqual(JSON.parse(localStorage.getItem("test.key")!), { a: 2 });
});

test("si localStorage.getItem lanza (modo privado, etc.) se mantiene el valor inicial sin romper", () => {
  const original = Storage.prototype.getItem;
  Storage.prototype.getItem = () => {
    throw new Error("acceso denegado");
  };
  try {
    const { result } = renderHook(() => useLocalStorageStore("test.key", { a: 1 }));
    assert.deepEqual(result.current[0], { a: 1 });
    assert.equal(result.current[2], true);
  } finally {
    Storage.prototype.getItem = original;
  }
});

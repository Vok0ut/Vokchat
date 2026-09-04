import { test } from "vitest";
import assert from "node:assert/strict";
import { cn } from "../utils";

test("cn combina clases y resuelve conflictos de Tailwind (el último gana)", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
});

test("cn ignora valores falsy (undefined, null, false, cadena vacía)", () => {
  assert.equal(cn("a", undefined, null, false, "", "b"), "a b");
});

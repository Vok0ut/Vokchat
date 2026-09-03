"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hidrata un valor desde localStorage tras el primer render (evita mismatch de
 * hidratación SSR: server y primer paint del cliente muestran `initial`, y el valor
 * real reemplaza un frame después). `hydrated` indica si ya se cargó desde storage.
 */
export function useLocalStorageStore<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = (raw) => JSON.parse(raw) as T,
  serialize: (v: T) => string = (v) => JSON.stringify(v),
): [T, (v: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Sincroniza con localStorage (sistema externo) tras el primer render — necesario
    // para el patrón de hidratación SSR-safe descrito arriba, no un anti-patrón.
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValueState(parse(raw));
    } catch {
      // localStorage inaccesible (modo privado, cuota, etc.) — se sigue con el valor inicial
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
        try {
          localStorage.setItem(key, serialize(next));
        } catch {
          // cuota excedida u otro fallo de storage — el estado en memoria sigue actualizado igual
        }
        return next;
      });
    },
    [key, serialize],
  );

  return [value, setValue, hydrated];
}

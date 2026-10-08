"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "vr:local-pref";

/**
 * Preferência do aparelho (ex.: ocultar cronômetro, tamanho da fonte) em localStorage.
 * useSyncExternalStore: no servidor/hidratação usa o padrão, depois lê o valor salvo — sem
 * mismatch e sem setState dentro de efeito. Falhas de storage (modo privado) caem no padrão.
 */
export function useLocalPref<T extends string | number | boolean>(key: string, fallback: T): [T, (v: T) => void] {
  const read = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      const v = JSON.parse(raw) as unknown;
      return typeof v === typeof fallback ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback]);
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(EVENT, cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener(EVENT, cb);
    };
  }, []);
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback((v: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set];
}

import { useCallback, useEffect, useState } from "react";
import { buildNamespacedKey, getUserScopedItem, setUserScopedItem } from "../utils/userStorage";

type Updater<T> = T | ((value: T) => T);

const isFunction = (val: unknown): val is Function => typeof val === "function";

export function useUserScopedStorage<T>(key: string, defaultValue: T, userId: string): [T, (value: Updater<T>) => void] {
  const readValue = useCallback((): T => {
    try {
      const raw = getUserScopedItem(key, userId);
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }, [defaultValue, key, userId]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  const setValue = useCallback(
    (value: Updater<T>) => {
      const newValue = isFunction(value) ? (value as (prev: T) => T)(storedValue) : (value as T);
      setStoredValue(newValue);
      try {
        const serialized = JSON.stringify(newValue);
        setUserScopedItem(key, serialized, userId);
      } catch {
        /* ignore write errors */
      }
    },
    [key, storedValue, userId]
  );

  // Helper to know the concrete key used (debug/inspection).
  (setValue as any).namespacedKey = buildNamespacedKey(userId, key);

  return [storedValue, setValue];
}


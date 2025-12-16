import { useState } from "react";

type Updater<T> = T | ((prev: T) => T);

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: Updater<T>) => void] {
  const readValue = () => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch {
      // ignore parse errors and fall back
    }

    return defaultValue;
  };

  const [value, setValue] = useState<T>(readValue);

  const setStoredValue = (nextValue: Updater<T>) => {
    const valueToStore = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(value) : nextValue;
    setValue(valueToStore);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch {
      // ignore write errors
    }
  };

  return [value, setStoredValue];
}

import { useState } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
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

  const setStoredValue = (nextValue: T) => {
    setValue(nextValue);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(nextValue));
      }
    } catch {
      // ignore write errors
    }
  };

  return [value, setStoredValue];
}

import { useEffect, useState } from "react";

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
  useEffect(()=>{
    const refresh=()=>setValue(readValue());
    window.addEventListener('moneylith:cloud-restored',refresh);
    return()=>window.removeEventListener('moneylith:cloud-restored',refresh);
  },[key]);

  const setStoredValue = (nextValue: Updater<T>) => {
    const valueToStore = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(value) : nextValue;
    try {
      // voorkom eindeloze renders bij identieke waarde
      if (JSON.stringify(valueToStore) === JSON.stringify(value)) {
        return;
      }
    } catch {
      /* ignore equality check errors */
    }
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new Event("moneylith:local-change"));
      }
    } catch {
      window.dispatchEvent(new CustomEvent("moneylith:storage-error",{detail:"Opslaan op dit apparaat is mislukt. De wijziging is niet opgeslagen; de eerdere gegevens zijn behouden. Maak eerst ruimte vrij."}));
      return;
    }
    setValue(valueToStore);
  };

  return [value, setStoredValue];
}

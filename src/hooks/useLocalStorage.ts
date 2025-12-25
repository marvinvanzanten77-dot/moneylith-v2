import { useCallback, useEffect, useState } from "react";
import { decryptString, encryptString, type EncryptedPayload } from "../utils/cryptoHelpers";
import { useCurrentUser, getDefaultUserId } from "../state/userContext";
import { buildNamespacedKey } from "../utils/userStorage";

type Updater<T> = T | ((prev: T) => T);
type StoredEncrypted = EncryptedPayload & { __enc: true };

const isEncryptedPayload = (value: any): value is StoredEncrypted =>
  Boolean(value && typeof value === "object" && value.__enc);

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: Updater<T>) => void] {
  const { id: currentUserId, profile, encryptionKey } = useCurrentUser();
  const isDefaultUser = currentUserId === getDefaultUserId();
  const namespacedKey = buildNamespacedKey(currentUserId, key);
  const encryptionEnabled = !!profile?.encryption?.enabled && !!encryptionKey && !isDefaultUser;
  const encryptionLocked = !!profile?.encryption?.enabled && !encryptionKey && !isDefaultUser;

  const [value, setValue] = useState<T>(defaultValue);

  const readValue = useCallback(async () => {
    if (typeof window === "undefined") return defaultValue;
    if (encryptionLocked) return defaultValue;
    const storage = window.localStorage;
    const candidates = [namespacedKey, key];
    for (const candidate of candidates) {
      const raw = storage.getItem(candidate);
      if (raw === null || raw === undefined) continue;
      try {
        const parsed = JSON.parse(raw);
        if (isEncryptedPayload(parsed)) {
          if (encryptionEnabled && encryptionKey) {
            const decrypted = await decryptString(parsed, encryptionKey);
            return JSON.parse(decrypted) as T;
          }
          continue;
        }
        return parsed as T;
      } catch {
        continue;
      }
    }
    return defaultValue;
  }, [defaultValue, encryptionEnabled, encryptionKey, encryptionLocked, key, namespacedKey]);

  useEffect(() => {
    let cancelled = false;
    readValue().then((val) => {
      if (!cancelled) setValue(val);
    });
    return () => {
      cancelled = true;
    };
  }, [readValue]);

  const persistValue = useCallback(
    (val: T) => {
      if (typeof window === "undefined" || encryptionLocked) return;
      const storage = window.localStorage;
      if (encryptionEnabled && encryptionKey) {
        encryptString(JSON.stringify(val), encryptionKey)
          .then((payload) => {
            storage.setItem(namespacedKey, JSON.stringify({ __enc: true, ...payload }));
          })
          .catch(() => {
            /* ignore */
          });
        return;
      }
      const targetKey = isDefaultUser ? key : namespacedKey;
      storage.setItem(targetKey, JSON.stringify(val));
    },
    [encryptionEnabled, encryptionKey, encryptionLocked, isDefaultUser, key, namespacedKey]
  );

  const setStoredValue = (nextValue: Updater<T>) => {
    const valueToStore = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(value) : nextValue;
    setValue(valueToStore);
    try {
      persistValue(valueToStore);
    } catch {
      /* ignore write errors */
    }
  };

  return [value, setStoredValue];
}

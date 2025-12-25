export const USER_NAMESPACE_PREFIX = "moneylith:v1";
export const USER_SCHEMA_VERSION = 1;

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const getStorage = (): StorageLike | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const buildNamespacedKey = (userId: string, key: string) => `${USER_NAMESPACE_PREFIX}:${userId}:${key}`;

export const getUserScopedItem = (key: string, userId: string): string | null => {
  const storage = getStorage();
  if (!storage) return null;
  const namespaced = buildNamespacedKey(userId, key);
  // Eerst namespaced, daarna legacy key (compat).
  const namespacedVal = storage.getItem(namespaced);
  if (namespacedVal !== null && namespacedVal !== undefined) return namespacedVal;
  return storage.getItem(key);
};

export const setUserScopedItem = (key: string, value: string, userId: string) => {
  const storage = getStorage();
  if (!storage) return;
  const namespaced = buildNamespacedKey(userId, key);
  storage.setItem(namespaced, value);
};

export const removeUserScopedItem = (key: string, userId: string) => {
  const storage = getStorage();
  if (!storage) return;
  const namespaced = buildNamespacedKey(userId, key);
  storage.removeItem(namespaced);
};

// No-op migrator placeholder: bestaande data blijft onaangeraakt.
export const runUserStorageMigrations = () => {
  // Hier kunnen later schema migraties komen. Nu niets doen om legacy data intact te laten.
  return { schemaVersion: USER_SCHEMA_VERSION, migrated: false };
};

